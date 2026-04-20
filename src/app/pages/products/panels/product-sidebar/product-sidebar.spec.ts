import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductSidebar } from './product-sidebar';

describe('ProductSidebar', () => {
  let component: ProductSidebar;
  let fixture: ComponentFixture<ProductSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductSidebar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductSidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
