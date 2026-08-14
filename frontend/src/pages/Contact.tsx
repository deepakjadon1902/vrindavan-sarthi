import { useState } from 'react';
import { MapPin, Phone, Mail, MessageCircle, Send } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { COMPANY_ADDRESS_LINE, COMPANY_EMAIL, COMPANY_NAME, COMPANY_PHONE, COMPANY_PHONE_DIGITS } from '@/lib/brand';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await api.post('/contact', formData);
      setSubmitted(true);
      toast.success('Message sent successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Message could not be sent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const whatsappLink = `https://wa.me/${COMPANY_PHONE_DIGITS}?text=${encodeURIComponent(`Hello ${COMPANY_NAME}, I need help with...`)}`;

  return (
    <div className="pt-16">
      <section className="section-cream py-4 lg:py-5">
        <div className="container mx-auto px-4">
          <SectionTitle label="Reach Out" title="Get In Touch" subtitle="We're here to help you plan your perfect Braj journey" />
        </div>
      </section>

      <section className="py-5 lg:py-6">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            {/* Left - Contact Info */}
            <div>
              <h3 className="font-heading text-2xl font-semibold text-foreground mb-3">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <MapPin className="text-brand-gold" size={18} />
                  </div>
                  <div>
                    <p className="font-body font-semibold text-foreground">Address</p>
                    <p className="font-body text-sm text-muted-foreground">{COMPANY_ADDRESS_LINE}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <Phone className="text-brand-gold" size={18} />
                  </div>
                  <div>
                    <p className="font-body font-semibold text-foreground">Phone</p>
                    <p className="font-body text-sm text-muted-foreground">{COMPANY_PHONE}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <Mail className="text-brand-gold" size={18} />
                  </div>
                  <div>
                    <p className="font-body font-semibold text-foreground">Email</p>
                    <p className="font-body text-sm text-muted-foreground">{COMPANY_EMAIL}</p>
                  </div>
                </div>
              </div>

              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 bg-brand-green text-primary-foreground font-body font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                <MessageCircle size={20} />
                Chat with us on WhatsApp →
              </a>

              {/* Map */}
              <div className="mt-4 rounded-lg overflow-hidden border border-border h-48">
                <iframe
                  src="https://www.google.com/maps?q=Raja%20wala%20mandir%2C%20Infront%20of%20Giriraj%20ji%20Maharaj%2C%20Goverdhan%2C%20Mathura%2C%20Uttar%20Pradesh%20281502&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  title={`${COMPANY_NAME} location`}
                />
              </div>
            </div>

            {/* Right - Form */}
            <div>
              {submitted ? (
                <div className="bg-brand-green/10 border border-brand-green/30 rounded-lg p-4 text-center">
                  <p className="font-heading text-2xl text-foreground mb-2">Thank You! 🙏</p>
                  <p className="font-body text-muted-foreground">We'll reply within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Name</label>
                      <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Your name" />
                    </div>
                    <div>
                      <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email</label>
                      <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="your@email.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Phone</label>
                      <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="+91 XXXXX XXXXX" />
                    </div>
                    <div>
                      <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Subject</label>
                      <input type="text" required value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="How can we help?" />
                    </div>
                  </div>
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Message</label>
                    <textarea required rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Tell us about your requirements..." />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-crimson px-8 py-3.5 rounded-xl flex items-center gap-2 w-full justify-center disabled:opacity-60">
                    <Send size={18} />
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;

