import type { ProductPreview } from "./types";

export const demoProduct: ProductPreview = {
  name: "iPhone 15 128GB Black",
  images: [
    "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1701901471350-f95826a9f2cb?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1695297798292-a53f2075c8e8?auto=format&fit=crop&w=1200&q=80"
  ],
  offers: [
    { store_name: "Irşad", price: 2899, stock: "Stokda var", link: "https://irshad.az/iphone15" },
    { store_name: "Kontakt Home", price: 2950, stock: "Stokda var", link: "https://kontakt.az/iphone15" },
    { store_name: "Baku Electronics", price: 3050, stock: "Stokda yoxdur", link: "https://baku-electronics.az/iphone15" }
  ],
  specs: {
    battery_mah: 3349,
    has_nfc: true,
    ram_gb: 6,
    storage_gb: 128,
    chipset_vendor: "Apple",
    chipset_model: "Apple A16 Bionic",
    os_name: "iOS",
    os_version: "18",
    sim_count: 2,
    main_camera_mp: 48,
    has_wireless_charge: true,
    has_5g: true,
    screen_size_in: 6.1,
    release_year: 2026,
    last_parsed_at: "2026-03-06T00:00:00.000Z"
  },
  price_history: [
    { date: "2026-01-01", price: 3000 },
    { date: "2026-01-07", price: 2990 },
    { date: "2026-01-14", price: 2950 },
    { date: "2026-01-21", price: 2900 },
    { date: "2026-01-28", price: 2899 }
  ],
  similar_products: [
    {
      name: "iPhone 15 256GB",
      image: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=900&q=80",
      link: "https://example.com/iphone15-256gb"
    },
    {
      name: "Samsung S23",
      image: "https://images.unsplash.com/photo-1678911820864-e5237f621f45?auto=format&fit=crop&w=900&q=80",
      link: "https://example.com/samsung-s23"
    },
    {
      name: "iPhone 14 128GB",
      image: "https://images.unsplash.com/photo-1603899122634-f086ca5f5ddd?auto=format&fit=crop&w=900&q=80",
      link: "https://example.com/iphone14"
    }
  ]
};
