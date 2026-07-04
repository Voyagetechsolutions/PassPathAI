# Play Store submission pack

Everything to copy-paste into the Google Play Console. Work top to bottom.

## 0. Before you start

1. Create the developer account at https://play.google.com/console ($25 once,
   personal account, use mthokochaza@gmail.com).
2. Create a free Expo account at https://expo.dev/signup (for building the app).
3. Build the app bundle (from this machine):
   ```powershell
   cd C:\Users\Mthokozisi.DESKTOP-DPOBCC1\Documents\PassPath\apps\mobile
   npx eas login          # once
   npx eas build -p android --profile production
   ```
   EAS handles signing automatically. When it finishes it gives you a link to
   download the `.aab` file — that's what you upload to Play Console.

## 1. App details

| Field | Value |
|---|---|
| App name | PassPath |
| Default language | English (South Africa) — en-ZA |
| App or game | App |
| Free or paid | Free |
| Category | Education |
| Email | mthokochaza@gmail.com |
| Website | https://passpathai-production.up.railway.app (or your domain) |
| Privacy policy URL | https://passpathai-production.up.railway.app/privacy.html |

## 2. Short description (max 80 chars)

> AI tutor, real DBE past papers & career guidance for SA Grades 8–12.

## 3. Full description

> **The AI tutor that actually teaches you.**
>
> PassPath is a study app built in South Africa for CAPS learners in Grades
> 8–12. Instead of dumping notes on you, a real AI tutor teaches every topic
> in a back-and-forth conversation — it explains your way (stories,
> real-world examples, or like you're 5), checks you're following, and
> remembers how you learn.
>
> **📚 Real past papers.** 287 DBE past exam papers and marking memos
> (2023–2025) across 14 Grade 12 subjects, built into your practice.
>
> **🧠 Explain it back.** When you think you've got a topic, explain it in
> your own words and get scored out of 10 — with exactly what to firm up.
>
> **📝 Mock exams, marked for you.** Timed papers built from real exam
> content, marked with feedback like a teacher would.
>
> **🎓 See where your marks can take you.** Enter your marks and PassPath
> calculates your APS live, matches you to 100 careers and 26 SA public
> universities, and shows what improving one subject unlocks.
>
> **📅 Stay on track.** Study streaks, a calendar of what you've learnt, and
> countdown to your exam dates.
>
> **What's free:** all subjects and topics, all past papers, career and APS
> guidance, the study calendar, and a trial of the AI tutor and mock exams.
> Premium (upgraded on our website) unlocks unlimited tutoring and unlimited
> marked mock exams.
>
> Built in South Africa 🇿🇦 for South African learners.

## 4. Graphics

| Asset | Spec | File |
|---|---|---|
| App icon | 512×512 PNG | `marketing/assets/play-icon-512.png` |
| Feature graphic | 1024×500 PNG | `marketing/assets/feature-graphic.png` |
| Phone screenshots | min 2, 9:16 | `marketing/assets/store-screens/01…08.png` — 8 framed 1080×1920 screens, upload in numeric order. Also reuse for the 7-inch and 10-inch tablet slots. |

## 5. Content rating questionnaire (IARC)

Answer **No** to everything (violence, sexuality, language, controlled
substances, gambling, user-generated content visible to others, sharing
location, digital purchases *inside the app*). Category: **Reference,
News, or Educational**. Expected rating: Everyone / PEGI 3.

Note: chat with the AI tutor is private to the learner — it is NOT
"user-generated content shared with other users".

## 6. Data safety form

**Does your app collect or share user data?** Yes, collects. No sharing.

| Data type | Collected? | Purpose | Optional? |
|---|---|---|---|
| Email address | Yes | Account management | Required |
| Name | Yes | Account management, personalisation | Required |
| Other info (grade, subjects, marks) | Yes | App functionality, personalisation | Required |
| Messages (tutor chat) | Yes | App functionality | Required |
| App interactions (topics studied, scores) | Yes | App functionality, personalisation | Required |

- All data encrypted in transit: **Yes** (HTTPS).
- Users can request deletion: **Yes** (email mthokochaza@gmail.com — also say
  this in the privacy policy).
- No location, no contacts, no photos, no advertising ID, no third-party
  ad SDKs, data not sold or shared.

## 7. Target audience

- Age groups: **13–15, 16–17, 18+** (do NOT tick under-13 — that triggers
  the much stricter Families programme).
- "Appeals to children"? Answer honestly: designed for teens (13+), not
  children under 13.

## 8. App access (reviewer credentials)

Google reviewers need a working login. Give them the dedicated reviewer
account (created for this purpose; it's a normal free student account):

- Email: `playreview@passpath.app`  *(see REVIEWER-ACCOUNT.md — not committed)*
- Instructions for reviewers: "Sign in with the provided email/password.
  All features are available immediately; no payment needed."

## 9. Ads & payments declarations

- Contains ads: **No**.
- In-app purchases: **None** — Premium is purchased on the website only; the
  Android app contains no purchase flow or checkout link (Play Billing not
  required).

## 10. Release path (the 12-tester rule)

New personal accounts must pass a closed test before production:

1. Play Console → Testing → **Closed testing** → create track "beta" →
   upload the `.aab` → add a tester email list (12+ Gmail addresses) → start.
2. Send testers the opt-in link; they install and keep it installed.
3. After **14 continuous days** with 12+ testers, apply for Production access
   (Console prompts you), then promote the build to Production.

Timeline for a 1 Aug launch: build + closed test live by ~10 July.
