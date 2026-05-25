import UIKit
import Capacitor

// Subclass del view controller principale di Capacitor.
// Forza background scuro (#0b1020) su view, WebView e scrollView per evitare
// le aree bianche native attorno e dentro la WebView (status bar overlay,
// home indicator e overscroll).
class BridgeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        applyBrandBackground()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        applyBrandBackground()
    }

    private func applyBrandBackground() {
        let brandDark = UIColor(red: 0x0b/255.0, green: 0x10/255.0, blue: 0x20/255.0, alpha: 1.0)
        view.backgroundColor = brandDark
        if let webView = self.webView {
            webView.backgroundColor = brandDark
            webView.isOpaque = false
            webView.scrollView.backgroundColor = brandDark
            webView.scrollView.bounces = true
        }
    }

    // Forza status bar bianca (testo chiaro) coerente con sfondo dark.
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
}
