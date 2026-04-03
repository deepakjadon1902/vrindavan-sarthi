const Privacy = () => (
  <div className="pt-24 pb-16 min-h-screen bg-background">
    <div className="container mx-auto px-4 max-w-4xl">
      <h1 className="font-heading text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
      <div className="bg-card rounded-xl border border-border p-8 space-y-6 font-body text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
          <p>We collect personal information you provide during registration: name, email, phone number, address. For partners, we also collect business details including GST number and business address.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
          <p>Your information is used to: process bookings, communicate booking confirmations, improve our services, send relevant updates, and comply with legal obligations.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">3. Data Sharing</h2>
          <p>We share necessary booking details with service providers (hotels, cab drivers) to fulfill your reservations. We do not sell your personal data to third parties.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">4. Data Security</h2>
          <p>We implement industry-standard security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">5. Cookies</h2>
          <p>We use cookies and local storage to maintain your session, remember preferences, and improve user experience on the platform.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">6. Your Rights</h2>
          <p>You have the right to access, update, or delete your personal information at any time through your profile settings or by contacting our support team.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-3">7. Contact Us</h2>
          <p>For privacy-related inquiries, contact us at privacy@vrindavansarthi.com or through our Contact page.</p>
        </section>
      </div>
    </div>
  </div>
);

export default Privacy;
