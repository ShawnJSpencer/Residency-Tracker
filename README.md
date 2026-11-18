# Residency Tracker

Planning and tracking app for the Utah Valley Hospital Psychiatry Residency startup (first PGY-1 class July 2028).

Plain HTML/CSS/JS with no build step and no dependencies. Host it with GitHub Pages (Settings → Pages → Deploy from branch `main`, folder `/`) or open `index.html` locally.

## Sections
- **Startup Planner** – Elizabeth's GME Gantt (Oct 2026 – Jul 2028): category-colored bars, a today line, owners, date notes, statuses, checklists, and the Notes & Contacts sheet. Tap **Edit bars** to paint months. **Import Excel** re-reads an updated copy of her workbook and merges it in.
- **Calendar** – meetings, interview days, didactic Thursdays and key dates. Exports an `.ics` file for Outlook.
- **Recruitment** – applicants (ERAS CSV import), interview days with schedules, a weighted scoring rubric, and the rank list.
- **CCC / PEC / Meetings** – agendas, attendance, minutes and action items, plus a tentative academic-year cycle generator.
- **Block Schedule** – 13 four-week blocks (or 12 months) per year by resident. Tap a block to choose a rotation or drag-paint with a brush; copy & stagger a class. Includes a coverage check (min/max per service), four-year requirement totals vs your targets, and an editable rotation list.
- **Didactics** – the Thursday 1–5 pm grid. Its tracks follow the PGY ramp-up, and it counts sessions against the 48-Thursday target.
- **Residents & Milestones** – roster by class, Psychiatry Milestones 2.0 ratings by CCC period, a cohort heatmap, and PRITE scores.
- **Faculty** – roles (CCC, PEC, interviewer…), website photo/bio status, New Innovations training, and faculty-development hours.
- **Accreditation** – ACGME new-program readiness checklist and policies.

## Data
All data stays in the browser's localStorage on each device. Nothing is sent to GitHub. To move data between devices, use **Settings → Download backup / Restore**. Don't commit backups to this repository if it is public.
