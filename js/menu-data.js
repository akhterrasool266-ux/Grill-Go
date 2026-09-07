// ============================================================
// DEMO MENU DATA
// Phase 1 mein ye static file hai. Phase 3 (admin panel) ke baad
// ye data Firestore se aayega: restaurants/{restaurantId}/menu
// Structure yahi rahega, sirf source badlega.
// ============================================================

const MENU_CATEGORIES = [
  { id: "burgers", name: "Flame Burgers", icon: "🍔" },
  { id: "pizza", name: "Pizza", icon: "🍕" },
  { id: "sides", name: "Sides", icon: "🍟" },
  { id: "drinks", name: "Drinks", icon: "🥤" }
];

const MENU_ITEMS = [
  {
    id: "b1",
    categoryId: "burgers",
    name: "Smoke Ember Burger",
    description: "Double flame-grilled patty, smoked cheddar, charred onions, ember sauce.",
    price: 850,
    image: "https://picsum.photos/seed/embergo-burger1/300/300",
    popular: true,
    sizes: [
      { id: "reg", name: "Regular", extra: 0 },
      { id: "big", name: "Double Stack", extra: 200 }
    ],
    addons: [
      { id: "a-cheese", name: "Extra Cheese", price: 80 },
      { id: "a-fries", name: "Add Fries", price: 150 }
    ]
  },
  {
    id: "b2",
    categoryId: "burgers",
    name: "Zinger Crunch",
    description: "Crispy fried chicken fillet, spicy mayo, iceberg lettuce.",
    price: 700,
    image: "https://picsum.photos/seed/embergo-burger2/300/300",
    popular: true,
    sizes: [
      { id: "reg", name: "Regular", extra: 0 },
      { id: "big", name: "Double Stack", extra: 180 }
    ],
    addons: [
      { id: "a-cheese", name: "Extra Cheese", price: 80 }
    ]
  },
  {
    id: "p1",
    categoryId: "pizza",
    name: "Fire Pepperoni",
    description: "Loaded pepperoni, mozzarella, chili-infused tomato base.",
    price: 1200,
    image: "https://picsum.photos/seed/embergo-pizza1/300/300",
    popular: true,
    sizes: [
      { id: "med", name: "Medium (9\")", extra: 0 },
      { id: "lg", name: "Large (12\")", extra: 400 }
    ],
    addons: [
      { id: "a-stcrust", name: "Stuffed Crust", price: 250 }
    ]
  },
  {
    id: "s1",
    categoryId: "sides",
    name: "Ember Fries",
    description: "Hand-cut fries tossed in smoked paprika salt.",
    price: 350,
    image: "https://picsum.photos/seed/embergo-fries1/300/300",
    popular: false,
    sizes: [],
    addons: [
      { id: "a-dip", name: "Cheese Dip", price: 100 }
    ]
  },
  {
    id: "d1",
    categoryId: "drinks",
    name: "Soda Can",
    description: "0.5 ltr chilled soda can.",
    price: 150,
    image: "https://picsum.photos/seed/embergo-soda1/300/300",
    popular: false,
    sizes: [],
    addons: []
  }
];

const MENU_OFFERS = [
  {
    id: "o1",
    title: "Weekend Fire Deal",
    subtitle: "Flat 15% off on all burgers",
    color: "primary"
  },
  {
    id: "o2",
    title: "Family Combo",
    subtitle: "2 Pizzas + 4 Drinks at Rs2,999",
    color: "accent"
  }
];
