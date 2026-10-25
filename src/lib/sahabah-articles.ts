
import { supabase } from "@/lib/supabase";

export type SahabahArticleStatus = "draft" | "published";

export type SahabahArticleReference = {
  title: string;
  detail?: string;
  url?: string | null;
};

export type SahabahArticle = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  companion_name: string | null;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  cover_image_url: string | null;
  cover_image_alt: string | null;
  source_references: SahabahArticleReference[];
  seo_title: string | null;
  seo_description: string | null;
  status: SahabahArticleStatus;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SahabahArticleInput = {
  title: string;
  subtitle?: string;
  slug: string;
  companion_name?: string;
  summary: string;
  content: string;
  category?: string;
  tags?: string[];
  cover_image_url?: string;
  cover_image_alt?: string;
  source_references?: SahabahArticleReference[];
  seo_title?: string;
  seo_description?: string;
  status: SahabahArticleStatus;
};

const ARTICLE_COLUMNS = `
  id,
  title,
  subtitle,
  slug,
  companion_name,
  summary,
  content,
  category,
  tags,
  cover_image_url,
  cover_image_alt,
  source_references,
  seo_title,
  seo_description,
  status,
  published_at,
  created_by,
  created_at,
  updated_at
`;

function normalizeArticleInput(input: SahabahArticleInput) {
  return {
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    slug: input.slug.trim().toLowerCase(),
    companion_name: input.companion_name?.trim() || null,
    summary: input.summary.trim(),
    content: input.content,
    category: input.category?.trim() || "Sahabah",
    tags: (input.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean),
    cover_image_url: input.cover_image_url?.trim() || null,
    cover_image_alt: input.cover_image_alt?.trim() || null,
    source_references: input.source_references ?? [],
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
    status: input.status,
  };
}

export function createArticleSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Retrieve published articles for the public directory.
 *
 * RLS ensures that only published articles are visible to
 * public visitors. The explicit filter also documents intent.
 */
export async function getPublishedSahabahArticles(): Promise<
  SahabahArticle[]
> {
  const { data, error } = await supabase
    .from("sahabah_articles")
    .select(ARTICLE_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(
      `Unable to load published Sahabah articles: ${error.message}`
    );
  }

  return (data ?? []) as unknown as SahabahArticle[];
}

/**
 * Retrieve one published article by slug.
 */
export async function getPublishedSahabahArticle(
  slug: string
): Promise<SahabahArticle | null> {
  const { data, error } = await supabase
    .from("sahabah_articles")
    .select(ARTICLE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load Sahabah article: ${error.message}`
    );
  }

  return data as unknown as SahabahArticle | null;
}

/**
 * Retrieve all articles for the admin interface, including drafts.
 * The database RLS policy restricts this operation to active admins.
 */
export async function getAdminSahabahArticles(): Promise<
  SahabahArticle[]
> {
  const { data, error } = await supabase
    .from("sahabah_articles")
    .select(ARTICLE_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      `Unable to load admin articles: ${error.message}`
    );
  }

  return (data ?? []) as unknown as SahabahArticle[];
}

/**
 * Retrieve one article for editing.
 * Draft access is restricted by RLS to active admins.
 */
export async function getAdminSahabahArticle(
  id: string
): Promise<SahabahArticle | null> {
  const { data, error } = await supabase
    .from("sahabah_articles")
    .select(ARTICLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load article for editing: ${error.message}`
    );
  }

  return data as unknown as SahabahArticle | null;
}

/**
 * Create an article.
 *
 * RLS verifies that the signed-in user is an active admin.
 */
export async function createSahabahArticle(
  input: SahabahArticleInput
): Promise<SahabahArticle> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in before creating an article.");
  }

  const values = normalizeArticleInput(input);

  validateArticleInput(values);

  const { data, error } = await supabase
    .from("sahabah_articles")
    .insert({
      ...values,
      created_by: user.id,
      published_at:
        values.status === "published"
          ? new Date().toISOString()
          : null,
    })
    .select(ARTICLE_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      `Unable to create article: ${error.message}`
    );
  }

  return data as unknown as SahabahArticle;
}

/**
 * Update an existing article.
 *
 * Publishing sets published_at if it has not already been set.
 * Unpublishing clears published_at.
 */
export async function updateSahabahArticle(
  id: string,
  input: SahabahArticleInput
): Promise<SahabahArticle> {
  const values = normalizeArticleInput(input);

  validateArticleInput(values);

  const { data: existing, error: existingError } =
    await supabase
      .from("sahabah_articles")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `Unable to retrieve existing article: ${existingError.message}`
    );
  }

  if (!existing) {
    throw new Error("The article could not be found.");
  }

  const publishedAt =
    values.status === "draft"
      ? null
      : existing.published_at ?? new Date().toISOString();

  const { data, error } = await supabase
    .from("sahabah_articles")
    .update({
      ...values,
      published_at: publishedAt,
    })
    .eq("id", id)
    .select(ARTICLE_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      `Unable to update article: ${error.message}`
    );
  }

  return data as unknown as SahabahArticle;
}

/**
 * Delete an article.
 *
 * The database policy restricts deletion to active admins.
 */
export async function deleteSahabahArticle(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("sahabah_articles")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to delete article: ${error.message}`
    );
  }
}

/**
 * Upload an image to the public article image bucket.
 *
 * Returns the public URL to save in cover_image_url or article
 * Markdown content. Upload permissions are enforced by Storage RLS.
 */
export async function uploadSahabahArticleImage(
  file: File
): Promise<string> {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "Choose a JPEG, PNG, WebP, or GIF image."
    );
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in before uploading an image.");
  }

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  const extension = extensionByType[file.type];
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("sahabah-article-images")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Unable to upload image: ${uploadError.message}`
    );
  }

  const { data } = supabase.storage
    .from("sahabah-article-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

function validateArticleInput(
  input: ReturnType<typeof normalizeArticleInput>
): void {
  if (!input.title) {
    throw new Error("Enter an article title.");
  }

  if (!input.slug) {
    throw new Error("Enter an article slug.");
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
    throw new Error(
      "The slug must contain lowercase letters, numbers, and single hyphens between words."
    );
  }

  if (!input.summary) {
    throw new Error("Enter an article summary.");
  }

  if (!input.content.trim()) {
    throw new Error("Enter the article content.");
  }

  for (const reference of input.source_references) {
    if (!reference.title?.trim()) {
      throw new Error(
        "Every source reference must have a title."
      );
    }

    if (reference.url) {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(reference.url);
      } catch {
        throw new Error(
          `Invalid reference URL: ${reference.url}`
        );
      }

      if (
        parsedUrl.protocol !== "https:" &&
        parsedUrl.protocol !== "http:"
      ) {
        throw new Error(
          "Reference links must use HTTP or HTTPS."
        );
      }
    }
  }
}
