import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Product, ProductForm } from '../../product.models';

@Component({
  selector: 'app-product-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductFormComponent implements OnChanges {
  @Input() categories: Category[] = [];
  @Input() editing: Product | null = null;
  @Input() saving = false;
  @Output() save = new EventEmitter<ProductForm>();
  @Output() cancel = new EventEmitter<void>();

  f: ProductForm = this.blank();

  blank(): ProductForm {
    return {
      name: '',
      categoryId: null,
      unit: 'Piece',
      barcode: '',
      barcode2: '',
      sku: '',
      costPrice: null,
      price: null,
      vatRate: 10,
      isVATInclusive: false,
      discount: 0,
      stockQty: 0,
      lowStockThreshold: 10,
      maxStock: null,
      log: '',
    };
  }

  ngOnChanges() {
    if (this.editing) {
      const p = this.editing;
      this.f = {
        name: p.Name,
        categoryId: p.CategoryId,
        unit: 'Piece',
        barcode: p.Barcode || '',
        barcode2: p.Barcode2 || '',
        sku: p.SKU || '',
        costPrice: null,
        price: p.Price,
        vatRate: p.VATRate,
        isVATInclusive: !!p.IsVATInclusive,
        discount: 0,
        stockQty: p.StockQty,
        lowStockThreshold: p.LowStockThreshold || 10,
        maxStock: null,
        log: '',
      };
    } else {
      this.f = this.blank();
    }
  }

  submit() {
    if (!this.f.name?.trim() || !this.f.price) return;
    this.save.emit({ ...this.f });
  }
}
