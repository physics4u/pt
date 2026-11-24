# PT — Physics Tuition Manager

This repo is the published website, served by GitHub Pages:

- https://physics4u.github.io/pt/ — the public website for parents and students
  (from `site/` in pt-code)
- https://physics4u.github.io/pt/app/ — the PT application, behind **Staff login**
  (from `web/` in pt-code)

The source and setup instructions are in **physics4u/pt-code**. Edit there and
run `publish.sh`. The only file that differs per deployment is
`app/js/site-config.js`, which holds the Apps Script `/exec` URL. The passcode is
never stored in this repo.
