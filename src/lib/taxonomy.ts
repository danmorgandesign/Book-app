// Shared book taxonomy for Bathampton Primary School Library.
// Flat hierarchy: Category (Fiction | Non-Fiction) -> Subcategory.
// Fiction uses the "Genrefication" model (genre + format).
// Non-Fiction uses thematic, curriculum-linked subject blocks.

export type Category = "Fiction" | "Non-Fiction";

export const SUBGENRES: Record<Category, string[]> = {
  Fiction: [
    // Core genres
    "Adventure & Survival",
    "Mystery & Crime",
    "Fantasy & Magic",
    "Sci-Fi & Space",
    "Humour / Funny",
    "Real Life & Relationships",
    "Animal Stories",
    "Historical Fiction",
    "Spooky & Ghost Stories",
    // Format-based
    "Graphic Novels & Comics",
    "Poetry & Plays",
    "Traditional Tales",
  ],
  "Non-Fiction": [
    "The Natural World (Science)",
    "Space & Earth Sciences",
    "History & Eras",
    "Geography & Cultures",
    "Technology & Computing",
    "The Arts, Culture & Beliefs",
    "Sports, Hobbies & Leisure",
    "Biographies & Real Lives",
  ],
};
