
import React, { useState, useEffect, useCallback } from "react";
import { Product } from "@/entities/Product";
import { CartItem } from "@/entities/CartItem";
import { User } from "@/entities/User";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Grid, List, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

import ProductCard from "../components/shop/ProductCard";
import ProductFilters from "../components/shop/ProductFilters";

export default function Shop() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");
  const [user, setUser] = useState(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    priceRange: [0, 1000],
    inStock: false
  });

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      // User not logged in
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Product.list();
      setProducts(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const applyFilters = useCallback(() => {
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(product =>
        filters.categories.includes(product.category)
      );
    }

    // Brand filter
    if (filters.brands.length > 0) {
      filtered = filtered.filter(product =>
        filters.brands.includes(product.brand)
      );
    }

    // Price filter
    if (filters.priceRange) {
      filtered = filtered.filter(product =>
        product.price >= filters.priceRange[0] &&
        product.price <= filters.priceRange[1]
      );
    }

    // Stock filter
    if (filters.inStock) {
      filtered = filtered.filter(product => product.stock > 0);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'newest':
          return new Date(b.created_date) - new Date(a.created_date);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  }, [products, searchTerm, filters, sortBy]);

  useEffect(() => {
    loadUser();
    loadProducts();
  }, [loadUser, loadProducts]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleAddToCart = async (product) => {
    if (user) {
      // Logged-in user logic
      try {
        const existingItems = await CartItem.filter({
          user_email: user.email,
          product_id: product.id
        });

        if (existingItems.length > 0) {
          const existingItem = existingItems[0];
          await CartItem.update(existingItem.id, {
            quantity: existingItem.quantity + 1
          });
        } else {
          await CartItem.create({
            product_id: product.id,
            quantity: 1,
            user_email: user.email
          });
        }
        toast({
          title: "Added to cart",
          description: `${product.name} has been added to your cart`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to add item to cart",
          variant: "destructive",
        });
      }
    } else {
      // Anonymous user logic
      const anonymousCart = JSON.parse(localStorage.getItem('anonymousCart') || '[]');
      const existingItemIndex = anonymousCart.findIndex(item => item.product_id === product.id);

      if (existingItemIndex > -1) {
        anonymousCart[existingItemIndex].quantity += 1;
      } else {
        anonymousCart.push({ product_id: product.id, quantity: 1, name: product.name, price: product.price, image_url: product.image_url, brand: product.brand });
      }
      localStorage.setItem('anonymousCart', JSON.stringify(anonymousCart));
      
      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart`,
      });
    }
    // Notify layout and other components that cart has changed
    window.dispatchEvent(new CustomEvent('cartUpdated'));
  };

  const handleProductClick = (product) => {
    // Would navigate to product detail page
    console.log("Product clicked:", product);
  };

  const clearFilters = () => {
    setFilters({
      categories: [],
      brands: [],
      priceRange: [0, 1000],
      inStock: false
    });
    setSearchTerm("");
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-96 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Discover Premium Collections
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Curated selection of luxury items from the world's finest brands
        </p>
      </motion.div>

      {/* Search and Controls */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search products, brands, categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 premium-shadow border-0"
          />
        </div>
        
        <div className="flex gap-3">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 h-12 premium-shadow border-0">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg premium-shadow bg-white">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-12 w-12"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-5 h-5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-12 w-12"
              onClick={() => setViewMode('list')}
            >
              <List className="w-5 h-5" />
            </Button>
          </div>

          <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden h-12 premium-shadow border-0">
                <SlidersHorizontal className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <ProductFilters
                filters={filters}
                onFiltersChange={setFilters}
                totalProducts={filteredProducts.length}
                onClearFilters={clearFilters}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar Filters - Desktop */}
        <div className="hidden lg:block">
          <ProductFilters
            filters={filters}
            onFiltersChange={setFilters}
            totalProducts={filteredProducts.length}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Products Grid */}
        <div className="lg:col-span-3">
          {filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-32 h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <Search className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria</p>
              <Button onClick={clearFilters} variant="outline">
                Clear all filters
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={
                  viewMode === 'grid'
                    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                    : "space-y-6"
                }
              >
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onProductClick={handleProductClick}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
