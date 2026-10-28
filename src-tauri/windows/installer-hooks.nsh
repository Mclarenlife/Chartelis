!macro NSIS_HOOK_POSTINSTALL
  ; Keep installer preference separate: existing in-app choices take precedence.
  WriteRegStr HKCU "Software\Chartelis" "InstallationLanguage" "$LANGUAGE"
!macroend
