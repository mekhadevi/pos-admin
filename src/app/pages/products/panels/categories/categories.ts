import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Product } from '../../product.models';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class Categories {
  @Input() categories: Category[] = [];
  @Input() products: Product[] = [];
  @Output() add = new EventEmitter<string>();
  @Output() delete = new EventEmitter<number>();
  newName = '';
  productCount(id: number) {
    return this.products.filter((p) => p.CategoryId === id).length;
  }
  doAdd() {
    if (this.newName.trim()) {
      this.add.emit(this.newName.trim());
      this.newName = '';
    }
  }
}
