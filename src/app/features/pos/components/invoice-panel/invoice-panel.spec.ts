import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoicePanel } from './invoice-panel';

describe('InvoicePanel', () => {
  let component: InvoicePanel;
  let fixture: ComponentFixture<InvoicePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicePanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvoicePanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
