import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Backup } from './backup';

describe('Backup', () => {
  let component: Backup;
  let fixture: ComponentFixture<Backup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Backup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Backup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
