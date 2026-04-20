import { Component, Input } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { PosStore } from '../../store/pos.store';

@Component({
  selector: 'app-product-card',
  imports: [],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  @Input() product!: Product;

  constructor(public store: PosStore) {}

  add() {
    this.store.addToCart(this.product);
    const audio = new Audio('sounds/addtocart.mp3');
    audio.play();
  }
}
