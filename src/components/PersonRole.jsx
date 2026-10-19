import { roleName } from '../lib/permissions.js';

// "Yohan (Captain)" with the name in bold — e.g. who approved a submission.
export default function PersonRole({ name, role }) {
  if (!name) return null;
  return <><b style={{ fontWeight: 800 }}>{name}</b>{role ? ` (${roleName(role)})` : ''}</>;
}
