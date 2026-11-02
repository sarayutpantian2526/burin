/* BURIN settings
   Put the two values from Supabase (Project Settings, API Keys) between the quotes,
   so every device that opens the app uses the same cloud. Leave empty to keep notebooks on each device only.
   "previous" names the project used before (Tokyo): it is only read, once per account, to move each person's
   notebooks and files to the new project (Singapore) the first time they sign in there. */
window.BURIN_CONFIG = {
  supabaseUrl: 'https://yaksbgryjnuwcrqtkgkd.supabase.co',
  supabaseKey: 'sb_publishable_mJTZXZ6JpFCMxM1TNVYXCA_hpeAzv0A',
  previous: {
    supabaseUrl: 'https://ibdxqqaiyvomtfenjizx.supabase.co',
    supabaseKey: 'sb_publishable_pfUDQbEK4Fji4zBGxlqG9Q_xSnexz-Q'
  }
};
