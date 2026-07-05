import { urlJoin } from "./utilities/urlJoin.ts";

function init() {
  function cleanUrl(s: string) {
    return s.trim().toLowerCase();
  }

  function escapeXml(input = "") {
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function canonicalUrl(siteUrl: string, pathname: string) {
    return urlJoin(siteUrl || "https://jster.net/", trimUrl(pathname));
  }

  function websiteJsonLd(siteUrl: string, siteName: string, description: string) {
    const url = urlJoin(siteUrl || "https://jster.net/");

    return [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName || "JSter",
        url,
        description: description || "JSter catalogues JavaScript libraries per purpose",
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: siteName || "JSter",
        url,
        sameAs: ["https://twitter.com/jsterlibs"],
      },
    ];
  }

  function catalogJsonLd(
    siteUrl: string,
    pathname: string,
    title: string,
    description: string,
    parentCategories: Array<{ title?: string; children?: Array<{ title?: string; url?: string }> }> = [],
  ) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title || "JSter Catalog",
      description: description || "JavaScript libraries per category",
      url: canonicalUrl(siteUrl, pathname),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: parentCategories
          .flatMap((parentCategory) => parentCategory.children || [])
          .map((category, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: category.title,
            url: absoluteUrl(siteUrl, category.url),
          })),
      },
    };
  }

  function collectionPageJsonLd(
    siteUrl: string,
    pathname: string,
    title: string,
    description: string,
    libraries: Array<Record<string, unknown>> = [],
  ) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description: description || `${title || "JavaScript"} libraries`,
      url: canonicalUrl(siteUrl, pathname),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: libraries.slice(0, 100).map((library, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: library.name,
          url: absoluteUrl(siteUrl, `/library/${library.id}/`),
        })),
      },
    };
  }

  function blogIndexJsonLd(
    siteUrl: string,
    pathname: string,
    title: string,
    description: string,
    blogPosts: Array<Record<string, unknown>> = [],
  ) {
    return {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: title || "JSter Blog",
      description: description || "News relevant to JavaScript",
      url: canonicalUrl(siteUrl, pathname),
      blogPost: blogPosts.slice(0, 50).map((blogPost) => ({
        "@type": "BlogPosting",
        headline: blogPost.title,
        url: absoluteUrl(siteUrl, blogPost.url),
        datePublished: blogPost.date,
      })),
    };
  }

  function blogPostJsonLd(
    siteUrl: string,
    pathname: string,
    title: string,
    description: string,
    document: Record<string, unknown> = {},
    siteName = "JSter",
  ) {
    const date = String(document.date || "");

    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: title,
      description: description || title,
      url: canonicalUrl(siteUrl, pathname),
      mainEntityOfPage: canonicalUrl(siteUrl, pathname),
      datePublished: date || undefined,
      dateModified: date || undefined,
      author: {
        "@type": "Person",
        name: document.user || "JSter",
      },
      publisher: {
        "@type": "Organization",
        name: siteName || "JSter",
        url: urlJoin(siteUrl || "https://jster.net/"),
      },
    };
  }

  function libraryJsonLd(
    siteUrl: string,
    pathname: string,
    library: Record<string, unknown> = {},
  ) {
    const sameAs = [getString(library, "links.site"), getString(library, "links.github")].filter(Boolean);

    return {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: library.name,
      description: library.description,
      url: canonicalUrl(siteUrl, pathname),
      codeRepository: getString(library, "links.github") || undefined,
      programmingLanguage: "JavaScript",
      keywords: Array.isArray(library.tags) ? library.tags.join(", ") : undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      isAccessibleForFree: true,
    };
  }

  return {
    blogIndexJsonLd,
    blogPostJsonLd,
    canonicalUrl,
    catalogJsonLd,
    cleanUrl,
    collectionPageJsonLd,
    escapeXml,
    libraryJsonLd,
    urlJoin,
    websiteJsonLd,
  };
}

export { init };

function absoluteUrl(siteUrl: string, path: unknown) {
  return urlJoin(siteUrl || "https://jster.net/", String(path || ""));
}

function getString(input: Record<string, unknown>, path: string) {
  const value = path.split(".").reduce<unknown>((ret, part) => {
    if (!ret || typeof ret !== "object") {
      return;
    }

    return (ret as Record<string, unknown>)[part];
  }, input);

  return typeof value === "string" ? value : "";
}

function trimUrl(url = "") {
  return url.replace(/^\/+|\/+$/g, "");
}
