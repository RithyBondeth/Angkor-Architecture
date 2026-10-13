export function icon(name: string, extra = ''): string {
  return `<i class="ph ph-${name} ${extra}" aria-hidden="true"></i>`;
}
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
