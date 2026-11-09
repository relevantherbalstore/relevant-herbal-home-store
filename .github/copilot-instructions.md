# Relevant Herbal Home Store

- Frontend: React, TypeScript, Vite. Keep the storefront responsive and accessible.
- Authentication and catalogue data use Firebase client SDK; never commit Firebase secrets.
- Only a Google-authenticated, verified `relevantherbalpharma@gmail.com` account is the store admin. Keep matching Firestore security rules in place; a client-side check alone is not authorization.
- Product descriptions must be factual and must not claim to diagnose, prevent, or cure medical conditions.
- Checkout hands off to WhatsApp and must show delivery as a separate additional charge.
- GitHub Pages builds use the repository base path supplied through `GITHUB_REPOSITORY`.
