import { PRODUCT_NAME } from '@/src/shared/constants';
import './App.css';

// Minimal placeholder popup. The full popup (connection status, active action,
// site-access mode, diagnostics — §21) is built in M2 with the messaging client.
function App() {
  return (
    <main className="latch-popup">
      <h1 className="latch-popup-title">{PRODUCT_NAME}</h1>
      <p className="latch-popup-tagline">
        Recent Gmail verification codes and links, on the site where you need them.
      </p>
      <section className="latch-popup-status">
        <span className="latch-popup-label">Gmail</span>
        <span className="latch-popup-value">Not connected</span>
      </section>
    </main>
  );
}

export default App;
