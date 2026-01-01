import { headers } from 'next/headers';

/**
 * Get the CSP nonce for the current request
 * Use this in Server Components to get the nonce for inline scripts
 *
 * @returns {string|null} The nonce or null if not available
 *
 * @example
 * // In a Server Component:
 * import { getNonce } from '@/lib/csp';
 *
 * export default async function Page() {
 *   const nonce = await getNonce();
 *   return (
 *     <script
 *       nonce={nonce}
 *       dangerouslySetInnerHTML={{ __html: '...' }}
 *     />
 *   );
 * }
 */
export async function getNonce() {
  try {
    const headersList = await headers();
    return headersList.get('x-nonce') || null;
  } catch {
    // headers() is not available in some contexts
    return null;
  }
}

/**
 * Create a Script component with the CSP nonce applied
 * This is a helper for adding inline scripts in Server Components
 *
 * @param {Object} props - Script props
 * @param {string} props.id - Unique identifier for the script
 * @param {string} props.children - The script content
 * @returns {JSX.Element} A script element with nonce
 */
export async function NonceScript({ id, children }) {
  const nonce = await getNonce();
  return (
    <script
      id={id}
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: children }}
    />
  );
}

/**
 * Generate script props with nonce for use in components
 *
 * @returns {Object} Props to spread on script elements
 */
export async function getScriptNonceProps() {
  const nonce = await getNonce();
  return nonce ? { nonce } : {};
}
