import React from 'react';
import QRCheckInScanner from '@/components/partner/QRCheckInScanner';

interface PartnerQRScannerPageProps {
  isAdmin?: boolean;
}

export const PartnerQRScannerPage: React.FC<PartnerQRScannerPageProps> = ({ isAdmin = false }) => {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <QRCheckInScanner isAdmin={isAdmin} />
    </div>
  );
};

export default PartnerQRScannerPage;
