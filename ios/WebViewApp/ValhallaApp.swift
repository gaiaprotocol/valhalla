import SwiftUI
import WebKit
import GoogleSignIn

// MARK: - OAuth Client IDs
let IOS_CLIENT_ID   = "797829770593-dlm0rhi8icjpgqenu196i8kfnm8r3d75.apps.googleusercontent.com"
let WEB_CLIENT_ID   = "797829770593-kv6v54u6gdebc4j4jhedjiql34ugg2fo.apps.googleusercontent.com"
let mainURL = URL(string: "https://valhalla.gaia.cc/?platform=ios&source=webview")!

// MARK: - Nonce helper
func generateNonce(_ count: Int = 16) -> String {
    var bytes = [UInt8](repeating: 0, count: count)
    _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
    let data = Data(bytes)
    return data.base64EncodedString()
        .replacingOccurrences(of: "=", with: "")
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
}

// MARK: - JS bridge script
fileprivate func makeNativeShimScript() -> WKUserScript {
    let js = """
    (function(){
      if (!window.Native) window.Native = {};
      window.Native.signInWithGoogle = function(){
        if (window.webkit?.messageHandlers?.signInWithGoogle) {
          window.webkit.messageHandlers.signInWithGoogle.postMessage(null);
        }
      };
      window.Native.signOutFromGoogle = function(){
        if (window.webkit?.messageHandlers?.signOutFromGoogle) {
          window.webkit.messageHandlers.signOutFromGoogle.postMessage(null);
        }
      };
    })();
    """
    return WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
}

enum NativeBridge: String { case signInWithGoogle, signOutFromGoogle }

// MARK: - Main WebView wrapper
struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var popupWebView: WKWebView?
    @Binding var progress: Double
    @Binding var isLoading: Bool

    func makeUIView(context: Context) -> WKWebView {
        let preferences = WKPreferences()
        preferences.javaScriptCanOpenWindowsAutomatically = true

        let config = WKWebViewConfiguration()
        config.preferences = preferences
        config.websiteDataStore = .default()

        let ucc = WKUserContentController()
        ucc.addUserScript(makeNativeShimScript())
        ucc.add(context.coordinator, name: NativeBridge.signInWithGoogle.rawValue)
        ucc.add(context.coordinator, name: NativeBridge.signOutFromGoogle.rawValue)
        config.userContentController = ucc

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.mainWebView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isInspectable = true
        webView.load(URLRequest(url: url))

        context.coordinator.progressObs = webView.observe(\.estimatedProgress, options: [.new]) { _, change in
            DispatchQueue.main.async { self.progress = change.newValue ?? 0 }
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    // MARK: - Coordinator
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var parent: WebView
        var progressObs: NSKeyValueObservation?
        weak var mainWebView: WKWebView?
        private var lastNonce: String = generateNonce()

        init(_ parent: WebView) { self.parent = parent }
        deinit { progressObs?.invalidate() }

        // Loading state
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async { self.parent.isLoading = true }
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async { self.parent.isLoading = false; self.parent.progress = 1.0 }
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async { self.parent.isLoading = false }
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async { self.parent.isLoading = false }
        }

        // External links
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let u = navigationAction.request.url, !(u.scheme == "http" || u.scheme == "https") {
                if UIApplication.shared.canOpenURL(u) { UIApplication.shared.open(u); decisionHandler(.cancel); return }
            }
            decisionHandler(.allow)
        }

        // Popups
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            let popup = WKWebView(frame: .zero, configuration: configuration)
            popup.navigationDelegate = self
            popup.uiDelegate = self
            parent.popupWebView = popup
            return popup
        }

        // JS → Native
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch NativeBridge(rawValue: message.name) {
            case .signInWithGoogle?: signIn()
            case .signOutFromGoogle?: signOut()
            case nil: break
            }
        }

        // Google Sign-In (v7)
        private func signIn() {
            guard let rootVC = UIApplication.shared.connectedScenes
                .compactMap({ ($0 as? UIWindowScene)?.keyWindow })
                .first?.rootViewController else {
                dispatchToWeb(event: "googleSignInFailed", payload: ["message": "NoRootVC"])
                return
            }

            lastNonce = generateNonce()
            GIDSignIn.sharedInstance.configuration =
                GIDConfiguration(clientID: IOS_CLIENT_ID, serverClientID: WEB_CLIENT_ID)

            GIDSignIn.sharedInstance.signIn(withPresenting: rootVC) { result, error in
                if let error = error {
                    self.dispatchToWeb(event: "googleSignInFailed", payload: ["message": "\(error)"])
                    return
                }
                guard let user = result?.user else {
                    self.dispatchToWeb(event: "googleSignInFailed", payload: ["message": "NoUser"])
                    return
                }

                if let idToken = user.idToken?.tokenString {
                    self.dispatchToWeb(
                        event: "googleSignInComplete",
                        payload: ["idToken": idToken, "nonce": self.lastNonce]
                    )
                } else {
                    self.dispatchToWeb(event: "googleSignInFailed", payload: ["message": "NoIDToken"])
                }
            }
        }

        private func signOut() {
            GIDSignIn.sharedInstance.signOut()
            let dataTypes: Set<String> = [
                WKWebsiteDataTypeCookies,
                WKWebsiteDataTypeSessionStorage,
                WKWebsiteDataTypeLocalStorage,
                WKWebsiteDataTypeIndexedDBDatabases,
                WKWebsiteDataTypeWebSQLDatabases
            ]
            WKWebsiteDataStore.default().fetchDataRecords(ofTypes: dataTypes) { records in
                WKWebsiteDataStore.default().removeData(ofTypes: dataTypes, for: records) {
                    self.dispatchToWeb(event: "googleSignOutComplete", payload: [:])
                }
            }
        }

        // Dispatch event to main/popup webviews
        private func dispatchToWeb(event: String, payload: [String: Any]) {
            let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: [])
            let json = String(data: jsonData ?? Data("{}".utf8), encoding: .utf8) ?? "{}"
            let js = "window.dispatchEvent(new CustomEvent('\(event)', {detail: \(json)}));"
            mainWebView?.evaluateJavaScript(js, completionHandler: nil)
            parent.popupWebView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

// MARK: - App entry
@main
struct ValhallaApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in _ = GIDSignIn.sharedInstance.handle(url) }
        }
    }
}

@available(iOS 13.0, *)
extension WKWebView: @retroactive Identifiable {
    public var id: ObjectIdentifier { ObjectIdentifier(self) }
}

struct WebViewRepresentable: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

// MARK: - ContentView
struct ContentView: View {
    @State private var popupWebView: WKWebView?
    @State private var progress: Double = 0.0
    @State private var isLoading: Bool = false

    var body: some View {
        ZStack {
            WebView(url: mainURL,
                    popupWebView: $popupWebView,
                    progress: $progress,
                    isLoading: $isLoading)
            .ignoresSafeArea()
            .sheet(item: $popupWebView) { WebViewRepresentable(webView: $0) }

            if isLoading || progress < 1.0 {
                Color.black.opacity(0.4).ignoresSafeArea()
                VStack(spacing: 12) {
                    ProgressView().progressViewStyle(.circular)
                    Text("\(Int((progress.clamped(to: 0...1)) * 100))%")
                        .font(.title3.weight(.semibold))
                        .foregroundColor(.white)
                }
            }
        }
    }
}

fileprivate extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
