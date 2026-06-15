import UIKit
import Capacitor

// Subclass del view controller principale di Capacitor.
// Tiene la WebView full-bleed: safe area e spazi della bottom nav sono gestiti
// dal CSS, evitando doppi inset nativi su iPhone.
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
            webView.scrollView.contentInsetAdjustmentBehavior = .never
            webView.scrollView.contentInset = .zero
            webView.scrollView.scrollIndicatorInsets = .zero
            webView.scrollView.bounces = true

            if #available(iOS 15.0, *) {
                webView.scrollView.automaticallyAdjustsScrollIndicatorInsets = false
            }
        }
    }

    // Forza status bar bianca (testo chiaro) coerente con sfondo dark.
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
}
