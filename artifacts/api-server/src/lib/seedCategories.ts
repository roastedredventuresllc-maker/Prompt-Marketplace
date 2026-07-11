import { db, categoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const CANONICAL_CATEGORIES = [
  { id: 9,  name: "Finance",         slug: "finance",       icon: "TrendingUp", description: "Investment analysis, financial planning, and market research prompts", sortOrder: 1  },
  { id: 10, name: "Law",             slug: "law",           icon: "Scale",       description: "Legal research, contract review, and compliance prompts",             sortOrder: 2  },
  { id: 1,  name: "Technology",      slug: "technology",    icon: "Code",        description: "Prompts for programming, debugging, and software development",        sortOrder: 3  },
  { id: 2,  name: "Writing",         slug: "writing",       icon: "PenTool",     description: "Prompts for creative writing, copywriting, and storytelling",         sortOrder: 4  },
  { id: 3,  name: "Marketing",       slug: "marketing",     icon: "TrendingUp",  description: "Prompts for campaigns, copy, and brand strategy",                     sortOrder: 5  },
  { id: 4,  name: "Data & Analytics",slug: "data-analytics",icon: "BarChart2",   description: "Prompts for data analysis, SQL, and insights",                       sortOrder: 6  },
  { id: 5,  name: "Design",          slug: "design",        icon: "Palette",     description: "Prompts for UI/UX, visual design, and creative direction",            sortOrder: 7  },
  { id: 6,  name: "Research",        slug: "research",      icon: "Search",      description: "Prompts for literature review, synthesis, and deep dives",            sortOrder: 8  },
  { id: 7,  name: "Business",        slug: "business",      icon: "Briefcase",   description: "Prompts for strategy, operations, and entrepreneurship",              sortOrder: 9  },
  { id: 8,  name: "Education",       slug: "education",     icon: "BookOpen",    description: "Prompts for teaching, learning, and curriculum design",              sortOrder: 10 },
] as const;

export async function seedCategories(): Promise<void> {
  for (const cat of CANONICAL_CATEGORIES) {
    await db
      .insert(categoriesTable)
      .values(cat)
      .onConflictDoUpdate({
        target: categoriesTable.id,
        set: {
          name:        sql`excluded.name`,
          icon:        sql`excluded.icon`,
          description: sql`excluded.description`,
          sortOrder:   sql`excluded.sort_order`,
          // slug is left unchanged to avoid breaking existing links
        },
      });
  }
}
