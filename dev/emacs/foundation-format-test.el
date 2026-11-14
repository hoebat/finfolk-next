;;; foundation-format-test.el --- Foundation editing checks -*- lexical-binding: t; -*-
(require 'ert)
(require 'clojure-mode)
(require 'foundation-format)

(ert-deftest foundation-format-indentation ()
  (dolist (pair '(("(fact \"example\"\n(result) => 1)"
                   . "(fact \"example\"\n  (result) => 1)")
                  ("(l/script :postgres\n{:runtime :jdbc.client})"
                   . "(l/script :postgres\n  {:runtime :jdbc.client})")
                  ("(pg/t:insert Table\n{:value 1})"
                   . "(pg/t:insert Table\n  {:value 1})")
                  ("(pg/g:select Table\n{:where {:id id}})"
                   . "(pg/g:select Table\n  {:where {:id id}})")
                  ("(deftype.pg ^{:final true}\nSample\n[:id {:type :text}])"
                   . "(deftype.pg ^{:final true}\n  Sample\n  [:id {:type :text}])")))
    (with-temp-buffer
      (clojure-mode)
      (insert (car pair))
      (indent-region (point-min) (point-max))
      (should (equal (buffer-string) (cdr pair))))))

(ert-deftest foundation-format-highlighting ()
  (with-temp-buffer
    (clojure-mode)
    (insert "(fact \"example\" (pg/t:get Table {}) => 1)\n(l/script :postgres {})\n(pg/g:select Table {})")
    (font-lock-ensure)
    (dolist (head '("fact" "pg/t:get" "l/script" "pg/g:select"))
      (goto-char (point-min))
      (search-forward head)
      (should (eq (get-text-property (1- (point)) 'face) 'font-lock-keyword-face)))
    (goto-char (point-min))
    (search-forward "=>")
    (should (eq (get-text-property (1- (point)) 'face) 'font-lock-preprocessor-face))))

(ert-deftest foundation-format-does-not-need-a-repl ()
  (should (equal (clojure--get-indent-method "pg/t:any-operation") 1))
  (should (equal (clojure--get-indent-method "pg/g:any-operation") 1))
  (should (equal (clojure--get-indent-method "l/script") 1))
  (should (equal (clojure--get-indent-method "code.test/fact") :defn)))

(ert-deftest foundation-format-buffer-integration ()
  (with-temp-buffer
    (clojure-mode)
    (insert "(fact \"example\" (+ 1 2) => 3)")
    (foundation-format-buffer)
    (should (equal (buffer-string) "(fact \"example\"\n  (+ 1 2) => 3)\n"))))
