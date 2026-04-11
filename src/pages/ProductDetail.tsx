import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useProductStore } from '@/store/productStore';
import UpiPayment from '@/components/UpiPayment';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { products, addOrder } = useProductStore();
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);

  const product = products.find(p => p.id === id);

  if (!product) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-heading text-2xl text-muted-foreground">Product not found</p>
      <Link to="/shop" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Shop</Link>
    </div>
  );

  const total = product.price * quantity;

  const handleBuyNow = () => {
    if (!isAuthenticated) { toast.error('Please login to buy'); navigate('/login'); return; }
    if (!address.trim()) { toast.error('Please enter shipping address'); return; }
    const tempId = `ORD-${Date.now()}`;
    setOrderId(tempId);
    setShowPayment(true);
  };

  const handlePaymentConfirm = (transactionId: string) => {
    const order = addOrder({
      productId: product.id,
      productName: product.name,
      productImage: product.images[0] || '',
      productPrice: product.price,
      quantity,
      totalAmount: total,
      userId: user!.id,
      userName: user!.name,
      userEmail: user!.email,
      userPhone: user!.phone,
      shippingAddress: address,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      upiTransactionId: transactionId,
    });
    setOrderId(order.id);
    setShowPayment(false);
    setOrdered(true);
    toast.success('Order placed! Payment verification pending.');
  };

  return (
    <div className="pt-20 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden h-80 md:h-[28rem] bg-muted">
              <img src={product.images[selectedImage] || '/placeholder.svg'} alt={product.name} className="w-full h-full object-cover" />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)} className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${selectedImage === i ? 'border-brand-gold' : 'border-border'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {showPayment ? (
              <UpiPayment amount={total} bookingId={orderId} itemName={product.name} onPaymentConfirm={handlePaymentConfirm} onCancel={() => setShowPayment(false)} />
            ) : ordered ? (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <CheckCircle size={56} className="mx-auto mb-4 text-brand-saffron" />
                <h3 className="font-heading text-2xl font-semibold text-foreground mb-2">Order Placed!</h3>
                <p className="font-body text-sm text-muted-foreground mb-1">Order ID: {orderId}</p>
                <p className="font-body text-sm text-muted-foreground mb-6">Your payment is being verified. You'll be notified once confirmed.</p>
                <Link to="/my-orders" className="btn-gold px-6 py-2.5 rounded-xl text-sm">View My Orders</Link>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded capitalize text-secondary-foreground">{product.category}</span>
                  <h1 className="font-heading text-3xl font-bold text-foreground mt-3">{product.name}</h1>
                  <p className="font-heading text-3xl font-bold text-brand-crimson mt-2">₹{product.price.toLocaleString('en-IN')}</p>
                </div>

                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="font-heading text-base font-semibold text-foreground mb-2">Description</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                </div>

                <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Quantity</label>
                    <input type="number" min={1} max={10} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                  </div>
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Shipping Address *</label>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Enter full shipping address..."
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" />
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex justify-between font-body text-sm"><span className="text-muted-foreground">₹{product.price.toLocaleString('en-IN')} × {quantity}</span><span>₹{total.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between font-body text-sm font-semibold border-t border-border pt-2 mt-2"><span>Total</span><span className="text-brand-crimson">₹{total.toLocaleString('en-IN')}</span></div>
                </div>

                <button onClick={handleBuyNow} className="btn-gold w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                  <ShoppingBag size={16} /> Buy Now
                </button>

                <div className="flex items-center gap-2 justify-center font-body text-xs text-muted-foreground">
                  <Truck size={14} /> Free delivery on orders above ₹500
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
