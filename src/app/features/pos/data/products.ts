import { Product } from '../../../core/models/product.model';

export const PRODUCTS: Product[] = [
  // --- BREAKFAST ---
  {
    id: 1,
    name: 'Classic Pancakes',
    price: 12,
    image: 'images/pancakes.png',
    category: 'Breakfast',
  },
  {
    id: 2,
    name: 'Egg Benedict',
    price: 15,
    image: 'images/eggs-benedict.png',
    category: 'Breakfast',
  },
  {
    id: 3,
    name: 'Avocado Toast',
    price: 14,
    image: 'images/avocado-toast.png',
    category: 'Breakfast',
  },

  // --- LUNCH ---
  { id: 4, name: 'Pasta Bolognese', price: 50, image: 'images/pasta.png', category: 'Lunch' },
  {
    id: 5,
    name: 'Spicy Chicken Burger',
    price: 45,
    image: 'images/chicken-burger.png',
    category: 'Lunch',
  },
  { id: 6, name: 'Ceasar Salad', price: 35, image: 'images/ceasar-salad.png', category: 'Lunch' },

  // --- DINNER ---
  { id: 7, name: 'Fish & Chips', price: 60, image: 'images/fish-chips.png', category: 'Dinner' },
  { id: 8, name: 'Grilled Salmon', price: 75, image: 'images/salmon.png', category: 'Dinner' },
  { id: 9, name: 'Ribeye Steak', price: 95, image: 'images/steak.png', category: 'Dinner' },

  // --- SOUP ---
  {
    id: 10,
    name: 'Tomato Basil Soup',
    price: 18,
    image: 'images/tomato-soup.png',
    category: 'soup',
  },
  {
    id: 11,
    name: 'Mushroom Cream',
    price: 20,
    image: 'images/mushroom-soup.png',
    category: 'soup',
  },

  // --- APPETIZER ---
  {
    id: 12,
    name: 'Garlic Bread',
    price: 10,
    image: 'images/garlic-bread.png',
    category: 'Appetizer',
  },
  {
    id: 13,
    name: 'Mozzarella Sticks',
    price: 15,
    image: 'images/cheese-sticks.png',
    category: 'Appetizer',
  },
  { id: 14, name: 'Bruschetta', price: 12, image: 'images/bruschetta.png', category: 'Appetizer' },

  // --- DESSERTS ---
  {
    id: 15,
    name: 'Chocolate Lava Cake',
    price: 25,
    image: 'images/lava-cake.png',
    category: 'Desserts',
  },
  {
    id: 16,
    name: 'New York Cheesecake',
    price: 22,
    image: 'images/cheesecake.png',
    category: 'Desserts',
  },
  {
    id: 17,
    name: 'Ice Cream Sundae',
    price: 15,
    image: 'images/ice-cream.png',
    category: 'Desserts',
  },

  // --- BEVERAGES ---
  {
    id: 18,
    name: 'Fresh Orange Juice',
    price: 12,
    image: 'images/orange-juice.png',
    category: 'Beverages',
  },
  { id: 19, name: 'Iced Americano', price: 10, image: 'images/coffee.png', category: 'Beverages' },
  { id: 20, name: 'Mineral Water', price: 5, image: 'images/water.png', category: 'Beverages' },
];
