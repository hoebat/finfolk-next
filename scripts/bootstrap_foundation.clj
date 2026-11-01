(require '[code.tool.maven :as m])
;; code.mcp is not a dependency of this app and has incomplete release metadata
;; at the pinned revision. Install the remaining declared Foundation packages.
(let [modules (vec (remove #{'xyz.zcaudate/code.mcp} (m/install :list {:tag :all})))
      result (m/install modules {:tag :all})]
  (System/exit (m/task-exit-code result)))
