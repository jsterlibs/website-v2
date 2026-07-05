const containers = document.querySelectorAll("[data-catalog]");

for (const container of containers) {
  if (container.dataset.rendered !== "true") {
    loadCatalog(container);
  }
}

async function loadCatalog(container) {
  const source = container.dataset.source || "category";
  const id = container.dataset.id;
  const pageSize = Number.parseInt(container.dataset.pageSize || "100", 10);
  const page = readPage();

  if (!id) {
    renderError(container);

    return;
  }

  try {
    const response = await fetch(
      `/api/${source}/${encodeURIComponent(id)}?page=${page}&pageSize=${pageSize}`,
    );

    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }

    renderCatalog(container, await response.json());
  } catch (error) {
    console.error(error);
    renderError(container);
  }
}

function renderCatalog(container, catalogPage) {
  container.replaceChildren();
  container.append(
    renderSummary(catalogPage),
    renderLibraries(catalogPage.libraries || []),
    renderPagination(catalogPage),
  );
}

function renderSummary({ page, pageCount, totalLibraries }) {
  const summary = document.createElement("p");
  summary.className = "text-sm text-gray-700";
  summary.textContent =
    pageCount > 1
      ? `Showing page ${page} of ${pageCount} (${totalLibraries} libraries)`
      : `Showing ${totalLibraries} libraries`;

  return summary;
}

function renderLibraries(libraries) {
  const list = document.createElement("ul");
  list.className = "catalog-list";

  for (const library of libraries) {
    list.append(renderLibrary(library));
  }

  return list;
}

function renderLibrary(library) {
  const item = document.createElement("li");
  item.className = "catalog-card";

  const title = document.createElement("a");
  title.className = "catalog-card-title";
  title.href = `/library/${library.id}`;
  title.textContent = library.name;
  item.append(title);

  if (library.status) {
    const status = document.createElement("div");
    status.className = "catalog-status";
    status.textContent = "Possibly inactive";
    item.append(status);
  }

  item.append(renderLibraryLinks(library));

  if (library.tags?.length) {
    item.append(renderTags(library.tags));
  }

  return item;
}

function renderLibraryLinks(library) {
  const links = document.createElement("div");
  links.className = "catalog-meta";

  if (library.stargazers) {
    const stars = document.createElement("div");
    const label = document.createElement("span");
    const count = document.createElement("span");
    stars.className = "flex gap-1";
    label.className = "catalog-meta-label";
    label.textContent = "Stars";
    count.textContent = library.stargazers;
    stars.append(label, count);
    links.append(stars);
  }

  if (library.links?.site) {
    const link = renderLink("Homepage", library.links.site);
    link.className = "catalog-meta-link";
    links.append(link);
  }

  if (library.links?.github) {
    const link = renderLink("GitHub", library.links.github);
    link.className = "catalog-meta-link";
    links.append(link);
  }

  return links;
}

function renderTags(tags) {
  const list = document.createElement("ul");
  list.className = "tag-list";

  for (const tag of tags) {
    const item = document.createElement("li");
    const link = renderLink(tag, `/tag/${tag}/`);
    link.className = "tag-chip";

    item.append(link);
    list.append(item);
  }

  return list;
}

function renderLink(label, href) {
  const link = document.createElement("a");
  link.className = "underline";
  link.href = href;
  link.textContent = label;

  return link;
}

function renderPagination({ page, pageCount }) {
  const nav = document.createElement("nav");
  nav.className = "flex items-center justify-between gap-4 border-t border-gray-200 pt-4";

  if (pageCount <= 1) {
    return nav;
  }

  if (page > 1) {
    nav.append(renderPageLink("Previous", page - 1));
  } else {
    nav.append(document.createElement("span"));
  }

  const current = document.createElement("span");
  current.className = "text-sm text-gray-700";
  current.textContent = `Page ${page} of ${pageCount}`;
  nav.append(current);

  if (page < pageCount) {
    nav.append(renderPageLink("Next", page + 1));
  } else {
    nav.append(document.createElement("span"));
  }

  return nav;
}

function renderPageLink(label, page) {
  const link = renderLink(label, pageUrl(page));
  link.className = "catalog-pagination-link";

  return link;
}

function readPage() {
  return parsePositiveInteger(new URLSearchParams(location.search).get("page"), 1);
}

function pageUrl(page) {
  const url = new URL(location.href);

  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }

  return url.pathname + url.search;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function renderError(container) {
  const error = document.createElement("p");
  error.className = "text-gray-700";
  error.textContent = "The catalog list could not be loaded.";
  container.replaceChildren(error);
}
