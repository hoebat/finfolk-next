;;; foundation-format.el --- Foundation DSL editing defaults -*- lexical-binding: t; -*-

(require 'cl-lib)
(require 'subr-x)
(require 'foundation-form-data)

(defgroup foundation-format nil "Foundation DSL editing." :group 'clojure)

(defcustom foundation-format-lein-program "lein"
  "Leiningen executable used for project-local zprint."
  :type 'string)

(defcustom foundation-format-java-home nil
  "Optional JAVA_HOME for formatter subprocesses."
  :type '(choice (const nil) directory))

(defun foundation-format--indent (original name)
  "Use Foundation indentation for NAME before consulting ORIGINAL."
  (let* ((short (car (last (split-string name "/"))))
         (entry (assoc short foundation-format-form-indents)))
    (cond (entry (cdr entry))
          ((string-match-p "\\`[tg]:" short) 1)
          (t (funcall original name)))))

(defconst foundation-format--head-regexp
  (concat "(\\(\\(?:[^][(){} \t\n\";/]+/\\)?\\(?:"
          (regexp-opt (mapcar #'car foundation-format-form-indents))
          "\\|[tg]:[[:alnum:]_!?+<>=.*-]+\\)\\)\\_>"))

(defun foundation-format--setup ()
  "Apply indentation, syntax highlighting and formatting commands."
  (font-lock-add-keywords
   nil `((,foundation-format--head-regexp 1 font-lock-keyword-face t)
         ("\\_<\\(?:=>\\|=not=>\\|=throws=>\\|=future=>\\|=eventually=>\\)\\_>"
          0 font-lock-preprocessor-face t)) 'append)
  ;; CIDER's usual formatting keys now use the same project formatter as CLI.
  (when (locate-dominating-file (or buffer-file-name default-directory) ".zprintrc")
    (local-set-key [remap cider-format-buffer] #'foundation-format-buffer)
    (local-set-key [remap cider-format-region] #'foundation-format-region))
  (font-lock-flush))

(defun foundation-format--replace (start end)
  "Format START through END using the nearest project's zprint config."
  (let* ((root (locate-dominating-file (or buffer-file-name default-directory) ".zprintrc"))
         (output (generate-new-buffer " *foundation-zprint*"))
         (errors (make-temp-file "foundation-zprint-errors-"))
         (process-environment (copy-sequence process-environment)))
    (unless root
      (kill-buffer output)
      (delete-file errors)
      (user-error "No project .zprintrc found"))
    (when foundation-format-java-home
      (setenv "JAVA_HOME" foundation-format-java-home))
    (unwind-protect
        (let* ((default-directory root)
               (status (call-process-region start end foundation-format-lein-program
                                            nil (list output errors) nil
                                            "zprint" "stdin"
                                            (or buffer-file-name "Emacs buffer"))))
          (unless (and (integerp status) (zerop status))
            (user-error "Zprint failed: %s"
                        (with-temp-buffer
                          (insert-file-contents errors)
                          (string-trim (buffer-string)))))
          (save-restriction
            (narrow-to-region start end)
            (atomic-change-group (replace-buffer-contents output))))
      (kill-buffer output)
      (delete-file errors))))

(defun foundation-format-buffer ()
  "Reflow the current Clojure buffer with the project's zprint rules."
  (interactive)
  (save-restriction
    (widen)
    (foundation-format--replace (point-min) (point-max))))

(defun foundation-format-region (start end)
  "Reflow complete Clojure forms between START and END."
  (interactive "r")
  (foundation-format--replace start end))

(with-eval-after-load 'clojure-mode
  (dolist (entry foundation-format-form-indents)
    (put-clojure-indent (intern (car entry)) (cdr entry)))
  (unless (advice-member-p #'foundation-format--indent #'clojure--get-indent-method)
    (advice-add 'clojure--get-indent-method :around #'foundation-format--indent))
  (add-hook 'clojure-mode-hook #'foundation-format--setup)
  (dolist (buffer (buffer-list))
    (with-current-buffer buffer
      (when (derived-mode-p 'clojure-mode) (foundation-format--setup)))))

(provide 'foundation-format)
;;; foundation-format.el ends here
