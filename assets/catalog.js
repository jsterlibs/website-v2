const containers = document.querySelectorAll("[data-catalog]");

for (const container of containers) {
  loadCatalog(container);
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
  list.className = "grid md:grid-cols-2 lg:grid-cols-3 gap-4";

  for (const library of libraries) {
    list.append(renderLibrary(library));
  }

  return list;
}

function renderLibrary(library) {
  const item = document.createElement("li");
  item.className = "my-4 flex flex-col gap-4 w-full bg-gray-200 rounded-lg p-4";

  const title = document.createElement("a");
  title.className =
    "underline bg-gray-100 hover:bg-gray-300 text-gray-800 p-4 border-fuchsia-600 rounded-lg";
  title.href = `/library/${library.id}`;
  title.textContent = library.name;
  item.append(title);

  if (library.status) {
    const status = document.createElement("div");
    status.className =
      "self-start border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950";
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
  links.className = "flex justify-between";

  if (library.links?.site) {
    links.append(renderLink("Homepage", library.links.site));
  }

  if (library.links?.github) {
    links.append(renderLink("GitHub page", library.links.github));
  }

  return links;
}

function renderTags(tags) {
  const list = document.createElement("ul");
  list.className = "flex flex-row flex-wrap gap-x-2 gap-y-4";

  for (const tag of tags) {
    const item = document.createElement("li");
    const link = renderLink(tag, `/tag/${tag}/`);
    link.className =
      "p-1 rounded-full border bg-violet-200 hover:bg-violet-300 font-extralight text-sm";

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
  link.className =
    "rounded border border-gray-300 px-3 py-2 no-underline hover:bg-gray-100";

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
