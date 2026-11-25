# FinFolk build extension

Source overlays for the pinned Foundation app.manage 4.1.8 package. These capture
the local workbench history, environment and panel extensions required by this
repository, so clean builds do not depend on an uncommitted submodule or a
private Maven prerelease. Upstream base: Foundation commit
`2db53cb9e59185dfc0b3a634a89a7066cbe00ff8`. MIT license retained in LICENSE.

`scripts/package_app_manage_history.py` overlays these authored files on the
base package installed by bootstrap. No remote package is published.
