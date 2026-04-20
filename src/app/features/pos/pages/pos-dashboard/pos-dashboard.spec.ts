import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PosDashboard } from './pos-dashboard';

describe('PosDashboard', () => {
  let component: PosDashboard;
  let fixture: ComponentFixture<PosDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PosDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
