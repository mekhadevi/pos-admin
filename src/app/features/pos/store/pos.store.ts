import { Injectable, signal, computed } from '@angular/core';
import { Product } from '../../../core/models/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root',
})
export class PosStore {
  products = signal<Product[]>([]);
  selectedCategory = signal<string>('All');
  cart = signal<CartItem[]>([]);

  // Filter products by category
  filteredProducts = computed(() => {
    if (this.selectedCategory() === 'All') {
      return this.products();
    }
    return this.products().filter((p) => p.category === this.selectedCategory());
  });

  // Subtotal
  subTotal = computed(() =>
    this.cart().reduce((acc, item) => acc + item.product.price * item.quantity, 0),
  );

  // Add product
  addToCart(product: Product) {
    const existing = this.cart().find((c) => c.product.id === product.id);

    if (existing) {
      existing.quantity++;
      this.cart.set([...this.cart()]);
    } else {
      this.cart.set([...this.cart(), { product, quantity: 1 }]);
    }
  }

  increase(item: CartItem) {
    item.quantity++;
    this.cart.set([...this.cart()]);
  }

  decrease(item: CartItem) {
    if (item.quantity > 1) {
      item.quantity--;
      this.cart.set([...this.cart()]);
    } else {
      this.cart.set(this.cart().filter((c) => c.product.id !== item.product.id));
    }
  }
  taxPercentage = signal<number>(5);

  taxAmount = computed(() => (this.subTotal() * this.taxPercentage()) / 100);

  grandTotal = computed(() => this.subTotal() + this.taxAmount());
  paymentMethod = signal<'cash' | 'card' | 'upi'>('cash');
  darkMode = signal<boolean>(false);

  toggleDark() {
    this.darkMode.update((v) => !v);
  }
}
