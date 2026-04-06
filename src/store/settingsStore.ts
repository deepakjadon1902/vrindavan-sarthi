import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  siteName: string;
  motto: string;
  logoUrl: string;
  upiId: string;
  upiName: string;
  adminPhone: string;
  adminEmail: string;
  termsOfService: string;
  privacyPolicy: string;
}

interface SettingsState {
  settings: AppSettings;
  updateSettings: (data: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  siteName: 'VrindavanSarthi',
  motto: 'Your Divine Guide to Vrindavan',
  logoUrl: '',
  upiId: '',
  upiName: 'VrindavanSarthi',
  adminPhone: '+91 9999999999',
  adminEmail: 'support@vrindavansarthi.com',
  termsOfService: `1. Acceptance of Terms
By accessing and using VrindavanSarthi ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.

2. Services
VrindavanSarthi provides an online platform for booking hotels, rooms, cabs, and tour packages in Vrindavan. We act as an intermediary between users and service providers (hotels, cab drivers, tour operators).

3. User Accounts
You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.

4. Bookings & Payments
All bookings are subject to availability. Hotel and tour payments are processed via UPI. Cab fares are paid directly to the driver at the destination. Booking confirmations are sent via the platform.

5. Cancellation & Refunds
Cancellation policies vary by service provider. Refunds, if applicable, will be processed within 7-10 business days. Cab bookings can be cancelled free of charge before the pickup time.

6. Partner Responsibilities
Partners listing hotels, rooms, cabs, or tours must provide accurate information. All listings are subject to admin verification. Misrepresentation may result in removal from the platform.

7. Limitation of Liability
VrindavanSarthi is not liable for the quality of services provided by third-party partners. We make every effort to verify listings but do not guarantee accuracy of all information.

8. Contact
For questions about these Terms, contact us at support@vrindavansarthi.com or visit our Contact page.`,
  privacyPolicy: `1. Information We Collect
We collect personal information you provide during registration: name, email, phone number, address. For partners, we also collect business details including GST number and business address.

2. How We Use Your Information
Your information is used to: process bookings, communicate booking confirmations, improve our services, send relevant updates, and comply with legal obligations.

3. Data Sharing
We share necessary booking details with service providers (hotels, cab drivers) to fulfill your reservations. We do not sell your personal data to third parties.

4. Data Security
We implement industry-standard security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.

5. Cookies
We use cookies and local storage to maintain your session, remember preferences, and improve user experience on the platform.

6. Your Rights
You have the right to access, update, or delete your personal information at any time through your profile settings or by contacting our support team.

7. Contact Us
For privacy-related inquiries, contact us at privacy@vrindavansarthi.com or through our Contact page.`,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (data) =>
        set((state) => ({
          settings: { ...state.settings, ...data },
        })),
    }),
    { name: 'vvs-settings' }
  )
);
