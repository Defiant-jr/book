export async function fetchAllPaginated(buildQuery, options = {}) {
  const pageSize = options.pageSize ?? 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      return { data: null, error };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: rows, error: null };
}
