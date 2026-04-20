import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentPanel } from './payment-panel';

describe('PaymentPanel', () => {
  let component: PaymentPanel;
  let fixture: ComponentFixture<PaymentPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
