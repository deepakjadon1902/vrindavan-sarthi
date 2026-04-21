import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Shield, Users, Clock, Heart } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import templeImg from '@/assets/images/temple-about.jpg';

const stats = [
  { value: '500+', label: 'Pilgrims Served' },
  { value: '3+', label: 'Years Experience' },
  { value: '50+', label: 'Temples Covered' },
  { value: '99%', label: 'Satisfaction Rate' },
];

const About = () => {
  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <img src={templeImg} alt="Vrindavan Temple" className="absolute inset-0 w-full h-full object-cover" loading="lazy" width={1280} height={720} />
        <div className="absolute inset-0 bg-foreground/60" />
        <div className="relative z-10 text-center px-4">
          <h1 className="font-brand text-3xl md:text-5xl text-brand-gold mb-3">About VrindavanSarthi</h1>
          <p className="font-heading italic text-xl text-primary-foreground/80">Where Devotion Meets Comfort</p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <SectionTitle label="Our Story" title="Guiding Pilgrims Since Day One" />
          <p className="font-body text-muted-foreground leading-relaxed">
            VrindavanSarthi was born from a simple idea — to make every pilgrim's journey to the sacred land of Lord Krishna as seamless and comfortable as possible. Just as Lord Krishna served as the divine charioteer (Sarthi) to Arjuna, we serve as your trusted guide through the holy city of Vrindavan.
          </p>
          <p className="font-body text-muted-foreground leading-relaxed mt-4">
            We connect devotees with verified hotels, comfortable rooms, reliable cabs, and insightful guided tours — all in one place. Every listing is personally verified, every service is curated with care, and every booking is backed by our commitment to your comfort and peace of mind.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading text-4xl font-bold text-brand-gold">{stat.value}</p>
                <p className="font-body text-sm text-primary-foreground/80 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-cream py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <SectionTitle label="Our Values" title="What Drives Us" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Heart, title: 'Devotion First', desc: 'Every decision starts with devotion to serving pilgrims' },
              { icon: Shield, title: 'Trust & Safety', desc: 'Verified listings and secure booking experience' },
              { icon: Users, title: 'Community', desc: 'Building a community of devotees and travelers' },
              { icon: Clock, title: 'Always Available', desc: 'Round-the-clock support for all your needs' },
            ].map((v) => (
              <div key={v.title} className="bg-card rounded-xl p-6 text-center border border-border">
                <div className="w-12 h-12 rounded-full bg-brand-gold/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="text-brand-gold" size={22} />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{v.title}</h3>
                <p className="font-body text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
