import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeatherIcon } from './weather-icon';

describe('WeatherIcon', () => {
  let component: WeatherIcon;
  let fixture: ComponentFixture<WeatherIcon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherIcon]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeatherIcon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
