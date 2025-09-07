
import React, { useState, useEffect, useCallback } from "react";
import { CartItem } from "@/entities/CartItem";
import { Product } from "@/entities/Product";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Cart() {
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [updating, setUpdating] = useState({});
  const [isMerging, setIsMerging] = useState(false);

  const mergeCarts = useCallback(async (localCart, userEmail) => {
    setIsMerging(true);
    try {
      const dbCartItems = await CartItem.filter({ user_email: userEmail });
      const dbCartMap = new Map(dbCartItems.map(item => [item.product_id, item]));

      const promises = localCart.map(localItem => {
        const dbItem = dbCartMap.get(localItem.product_id);
        if (dbItem) {
          // Item exists in DB, update quantity
          return CartItem.update(dbItem.id, { quantity: dbItem.quantity + localItem.quantity });
        } else {
          // Item does not exist, create it
          return CartItem.create({
            product_id: localItem.product_id,
            quantity: localItem.quantity,
            user_email: userEmail
          });
        }
      });
      
      await Promise.all(promises);
      localStorage.removeItem('anonymousCart');
      
      toast({
        title: "Cart Updated",
        description: "Your guest cart has been merged with your account.",
      });

    } catch (err) {
      console.error("Error merging carts:", err);
      toast({
        title: "Error merging carts",
        description: "There was a problem merging your carts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsMerging(false);
      window.dispatchEvent(new CustomEvent('cartUpdated'));
    }
  }, [toast]);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const localCart = JSON.parse(localStorage.getItem('anonymousCart') || '[]');
      if (localCart.length > 0 && currentUser?.email) {
        await mergeCarts(localCart, currentUser.email);
      }
    } catch (error) {
      setUser(null); // Explicitly set user to null if not logged in
    }
  }, [mergeCarts]);

  const loadCartItems = useCallback(async () => {
    if (!user?.email) {
      // Load from local storage for anonymous user
      setLoading(true);
      const localCart = JSON.parse(localStorage.getItem('anonymousCart') || '[]');
      const productMap = {};
      localCart.forEach(item => {
        // Assume anonymousCart items have sufficient product details (name, price, image_url, brand)
        productMap[item.product_id] = { id: item.product_id, name: item.name, price: item.price, image_url: item.image_url, brand: item.brand };
      });
      setProducts(productMap);
      // For guest cart items, use product_id as the unique 'id' for consistent keying and updating state
      setCartItems(localCart.map(item => ({...item, id: item.product_id}))); 
      setLoading(false);
      return;
    }
    
    // Logged-in user: Load from database
    setLoading(true);
    try {
      const items = await CartItem.filter({ user_email: user.email });
      setCartItems(items);
      
      // Load product details
      const productIds = [...new Set(items.map(item => item.product_id))];
      const productList = productIds.length > 0 ? await Product.filter({ id: productIds }) : [];
      
      const productMap = {};
      productList.forEach(product => {
        productMap[product.id] = product;
      });
      setProducts(productMap);
    } catch (error) {
      console.error("Failed to load cart items:", error);
      toast({
        title: "Error",
        description: "Failed to load cart items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.email, toast]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    // This effect now handles both logged-in and anonymous users
    // Re-loads when user changes or after a merge operation completes
    loadCartItems();
  }, [user, loadCartItems, isMerging]);

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setUpdating(prev => ({ ...prev, [productId]: true })); // Use productId for updating state key
    
    if (user) {
      // Logged-in user: Update in database
      const cartItem = cartItems.find(item => item.product_id === productId);
      if (!cartItem) {
        setUpdating(prev => ({ ...prev, [productId]: false }));
        return; 
      }
      try {
        await CartItem.update(cartItem.id, { quantity: newQuantity });
      } catch (error) {
        console.error("Failed to update quantity in DB:", error);
        toast({
          title: "Error",
          description: "Failed to update quantity",
          variant: "destructive",
        });
      }
    } else {
      // Anonymous user: Update in local storage
      let localCart = JSON.parse(localStorage.getItem('anonymousCart') || '[]');
      localCart = localCart.map(item => item.product_id === productId ? { ...item, quantity: newQuantity } : item);
      localStorage.setItem('anonymousCart', JSON.stringify(localCart));
    }
    
    await loadCartItems(); // Reload to reflect changes
    window.dispatchEvent(new CustomEvent('cartUpdated')); // Notify other components
    setUpdating(prev => ({ ...prev, [productId]: false }));
  };

  const removeItem = async (productId) => {
    setUpdating(prev => ({ ...prev, [productId]: true })); // Use productId for updating state key

    if (user) {
      // Logged-in user: Remove from database
      const cartItem = cartItems.find(item => item.product_id === productId);
      if (!cartItem) {
        setUpdating(prev => ({ ...prev, [productId]: false }));
        return;
      }
      try {
        await CartItem.delete(cartItem.id);
        toast({ 
          title: "Item removed",
          description: "Item has been removed from your cart",
        });
      } catch (error) {
        console.error("Failed to remove item from DB:", error);
        toast({
          title: "Error",
          description: "Failed to remove item",
          variant: "destructive",
        });
      }
    } else {
      // Anonymous user: Remove from local storage
      let localCart = JSON.parse(localStorage.getItem('anonymousCart') || '[]');
      localCart = localCart.filter(item => item.product_id !== productId);
      localStorage.setItem('anonymousCart', JSON.stringify(localCart));
      toast({ 
        title: "Item removed",
        description: "Item has been removed from your cart",
      });
    }
    await loadCartItems(); // Reload
    window.dispatchEvent(new CustomEvent('cartUpdated')); // Notify other components
    setUpdating(prev => ({ ...prev, [productId]: false }));
  };

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const product = products[item.product_id];
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  };

  const getTax = () => {
    return getSubtotal() * 0.08; // 8% tax
  };

  const getTotal = () => {
    return getSubtotal() + getTax();
  };

  if (loading || isMerging) { // Show specific loading state for merging
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-lg font-medium">{isMerging ? "Merging your cart..." : "Loading your cart..."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-16 h-16 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-8">
            Looks like you haven't added anything to your cart yet.
          </p>
          <Link to={createPageUrl("Shop")}>
            <Button className="gold-gradient text-white">
              Start Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link to={createPageUrl("Shop")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
        <span className="text-sm text-gray-500">({cartItems.length} items)</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {cartItems.map((item) => {
              const product = products[item.product_id];
              if (!product) return null;

              return (
                <motion.div
                  key={item.id} // item.id will be product_id for guest cart, or actual DB id for logged-in
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  layout
                >
                  <Card className="premium-card border-0">
                    <CardContent className="p-6">
                      <div className="flex gap-6">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">
                              {product.name}
                            </h3>
                            <p className="text-sm text-gray-500">{product.brand}</p>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.product_id, item.quantity - 1)} // Pass product_id
                                disabled={updating[item.product_id] || item.quantity <= 1} // Use product_id for disabled state
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              
                              <span className="font-medium text-lg w-8 text-center">
                                {item.quantity}
                              </span>
                              
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.product_id, item.quantity + 1)} // Pass product_id
                                disabled={updating[item.product_id]} // Use product_id for disabled state
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            <div className="text-right">
                              <p className="font-bold text-xl">
                                ${(product.price * item.quantity).toFixed(2)}
                              </p>
                              <p className="text-sm text-gray-500">
                                ${product.price.toFixed(2)} each
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(item.product_id)} // Pass product_id
                          disabled={updating[item.product_id]} // Use product_id for disabled state
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="premium-card border-0 sticky top-8">
            <CardHeader>
              <CardTitle className="text-xl">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${getSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${getTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${getTotal().toFixed(2)}</span>
              </div>
              
              {user ? ( // Conditional rendering for checkout button
                <Button 
                  className="w-full gold-gradient text-white h-12 text-lg font-semibold"
                  onClick={() => {
                    toast({
                      title: "Checkout",
                      description: "Checkout functionality would be implemented here",
                    });
                  }}
                >
                  Proceed to Checkout
                </Button>
              ) : (
                <Button 
                  className="w-full gold-gradient text-white h-12 text-lg font-semibold"
                  onClick={() => User.loginWithRedirect(window.location.href)} // Redirect to login
                >
                  Sign In to Checkout
                </Button>
              )}
              
              <p className="text-xs text-gray-500 text-center">
                Free shipping on orders over $50
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
