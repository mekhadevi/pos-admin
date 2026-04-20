import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LowStockAlerts } from './low-stock-alerts';

describe('LowStockAlerts', () => {
  let component: LowStockAlerts;
  let fixture: ComponentFixture<LowStockAlerts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LowStockAlerts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LowStockAlerts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
