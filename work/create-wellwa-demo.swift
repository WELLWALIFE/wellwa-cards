import Foundation
import AVFoundation
import AppKit
import CoreVideo

struct Segment {
    let image: String
    let contain: Bool
}

let project = "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards"
let output = URL(fileURLWithPath: project + "/public/wellwa/video/wellwa-product-tour.mp4")
let segments = [
    Segment(image: project + "/work/wellwa-deck/assets/aura-plus-kitchen-hero.png", contain: false),
    Segment(image: project + "/work/wellwa-deck/assets/aura-5.png", contain: true),
    Segment(image: project + "/work/wellwa-deck/assets/aura-plus-7.png", contain: true),
    Segment(image: project + "/work/wellwa-deck/assets/aura-maxx.png", contain: true),
    Segment(image: project + "/work/wellwa-deck/assets/home-demo-consultation.png", contain: false),
    Segment(image: project + "/work/wellwa-deck/assets/distributor-training.png", contain: false),
]

let width = 1280
let height = 720
let fps: Int32 = 30
let secondsPerSegment = 4
let framesPerSegment = Int(fps) * secondsPerSegment
let totalFrames = framesPerSegment * segments.count

try? FileManager.default.removeItem(at: output)
try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)

func cgImage(_ path: String) throws -> CGImage {
    guard let image = NSImage(contentsOfFile: path) else {
        throw NSError(domain: "WellwaVideo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to load \(path)"])
    }
    var rect = NSRect(origin: .zero, size: image.size)
    guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw NSError(domain: "WellwaVideo", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to rasterize \(path)"])
    }
    return cg
}

let images = try segments.map { try cgImage($0.image) }
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 3_500_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
])
guard writer.canAdd(input) else { fatalError("Cannot add video input") }
writer.add(input)
guard writer.startWriting() else { throw writer.error ?? NSError(domain: "WellwaVideo", code: 3) }
writer.startSession(atSourceTime: .zero)

func draw(_ image: CGImage, contain: Bool, progress: CGFloat, alpha: CGFloat, in context: CGContext) {
    let iw = CGFloat(image.width), ih = CGFloat(image.height)
    let baseScale = contain ? min(CGFloat(width) / iw, CGFloat(height) / ih) * 0.78 : max(CGFloat(width) / iw, CGFloat(height) / ih)
    let scale = baseScale * (contain ? 1.0 : 1.0 + 0.035 * progress)
    let dw = iw * scale, dh = ih * scale
    let rect = CGRect(x: (CGFloat(width) - dw) / 2, y: (CGFloat(height) - dh) / 2, width: dw, height: dh)
    context.saveGState()
    context.setAlpha(alpha)
    context.draw(image, in: rect)
    context.restoreGState()
}

for frame in 0..<totalFrames {
    while !input.isReadyForMoreMediaData { usleep(2_000) }
    guard let pool = adaptor.pixelBufferPool else { fatalError("Missing pixel buffer pool") }
    var maybeBuffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &maybeBuffer)
    guard let buffer = maybeBuffer else { fatalError("Unable to allocate frame") }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { fatalError("Missing frame memory") }
    let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
    guard let context = CGContext(
        data: base,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: rowBytes,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { fatalError("Unable to create frame context") }

    context.setFillColor(NSColor(calibratedRed: 0.965, green: 0.955, blue: 0.925, alpha: 1).cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let segmentIndex = min(frame / framesPerSegment, segments.count - 1)
    let segmentFrame = frame % framesPerSegment
    let progress = CGFloat(segmentFrame) / CGFloat(framesPerSegment - 1)
    draw(images[segmentIndex], contain: segments[segmentIndex].contain, progress: progress, alpha: 1, in: context)

    if progress > 0.86 && segmentIndex + 1 < segments.count {
        let fade = min(1, (progress - 0.86) / 0.14)
        context.setFillColor(NSColor(calibratedRed: 0.965, green: 0.955, blue: 0.925, alpha: fade).cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        draw(images[segmentIndex + 1], contain: segments[segmentIndex + 1].contain, progress: 0, alpha: fade, in: context)
    }

    let time = CMTime(value: CMTimeValue(frame), timescale: fps)
    if !adaptor.append(buffer, withPresentationTime: time) {
        throw writer.error ?? NSError(domain: "WellwaVideo", code: 4)
    }
}

input.markAsFinished()
await writer.finishWriting()
if writer.status != .completed {
    throw writer.error ?? NSError(domain: "WellwaVideo", code: 5)
}
print(output.path)
