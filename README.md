# Relevant Herbal Home Store

A responsive React + TypeScript storefront prepared for GitHub Pages, with Google sign-in for the store administrator, a Firestore-backed catalogue, a shopping bag, and WhatsApp order handoff.

## Run locally

1. Install Node.js 22 or newer.
2. Install packages with `npm install`.
3. Copy `.env.example` to `.env.local` and add the Firebase web app configuration.
4. Start the development server with `npm run dev`.
5. Run a production check with `npm run build`.

Without Firebase configuration, the page shows the brochure-based draft catalogue; Google sign-in and live catalogue updates remain unavailable until Firebase is configured.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. In Firebase Authentication, enable Google as a sign-in provider. Add the final GitHub Pages domain to Authorized domains.
3. Create a Cloud Firestore database.
4. Copy the web app configuration values into `.env.local` using the variable names in `.env.example`.
5. Publish the included `firestore.rules` to Firestore. Public visitors can read products; only the Google-authenticated, email-verified `relevantherbalpharma@gmail.com` account can create, update, or delete catalogue entries.
6. Hosted image URLs work without Storage. Direct uploads require enabling Firebase Storage; the console currently requires upgrading this project from Spark to Blaze (billing account), so no upgrade was performed. If you choose to enable it, publish `storage.rules`; uploads are limited to images under 5 MB and restricted to the verified admin.

The client checks the same admin email for the management screen, while Firestore rules provide the actual authorization boundary. Never rely on a front-end-only admin check.

## Add products

Sign in from the person/account icon using the verified Google account above. The admin panel can add name, price (INR), description, category, discount, stock, and an image URL; direct image uploads require Firebase Storage on the Blaze plan. The live catalogue updates from Firestore. The initial catalogue is transcribed from the supplied brochure. Its price list is marked March 2022, so every item's current price, availability, pack size, label, and image must be checked before accepting orders. Product copy is intentionally neutral and does not repeat health claims from the brochure.

## Orders and delivery

The bag summarizes item prices in INR, adds a separate delivery line, and opens WhatsApp with the order text. The delivery fee is currently a draft value of **₹250**, configured as `DELIVERY_FEE` in `src/Storefront.tsx`; confirm or change it before launch. The WhatsApp link uses the number exactly as supplied (`9238392977`); verify that it is the correct full WhatsApp number before launch.

## GitHub Pages deployment

1. Create a GitHub repository and push this project to its `main` branch.
2. In repository Settings → Pages, choose **GitHub Actions** as the build and deployment source.
3. In repository Settings → Secrets and variables → Actions → Variables, add the six `VITE_FIREBASE_*` values from `.env.example`. The Firebase web configuration is public client configuration; Firestore rules must protect writes.
4. Add `relevantherbalstore.github.io` to Firebase Authentication's Authorized domains for this deployment.
5. Push to `main` or run the **Deploy to GitHub Pages** workflow manually. The workflow builds the app with the repository subpath automatically.

For a custom domain or a user/organization Pages repository, adjust the Vite `base` setting as appropriate. Firebase configuration and verified hosting domain must be in place for Google sign-in to work on the deployed site.

## Health information

This store is for product browsing and order enquiries, not medical advice. Product listings must remain factual and must not claim to diagnose, prevent, or cure disease. Customers should consult a qualified healthcare professional for medical questions.
