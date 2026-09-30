import AVFoundation
import AppKit
// extract <video> <outdir> <x> <y> <w> <h> : every frame, cropped, as PNG
let a = CommandLine.arguments
let url = URL(fileURLWithPath: a[1]); let out = a[2]
let cx = Int(a[3])!, cy = Int(a[4])!, cw = Int(a[5])!, ch = Int(a[6])!
let asset = AVURLAsset(url: url)
let track = asset.tracks(withMediaType: .video)[0]
print("fps", track.nominalFrameRate, "size", track.naturalSize, "transform", track.preferredTransform)
let reader = try! AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(output)
reader.startReading()
var i = 0
let ctx = CIContext()
while let sample = output.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sample) else { continue }
  let ci = CIImage(cvPixelBuffer: pb)
  let H = Int(ci.extent.height)
  // CoreImage origin is bottom-left
  let rect = CGRect(x: cx, y: H - cy - ch, width: cw, height: ch)
  let cg = ctx.createCGImage(ci, from: rect)!
  let rep = NSBitmapImageRep(cgImage: cg)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: String(format: "%@/f%04d.png", out, i)))
  i += 1
}
print("frames", i, reader.status.rawValue)
