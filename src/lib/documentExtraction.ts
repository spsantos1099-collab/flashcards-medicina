import * as mammoth from "mammoth";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { DocumentExtension, ExtractedDocument, ExtractedPage } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ExtractionErrorCode =
  | "no_extractable_text"
  | "password_protected"
  | "invalid_document"
  | "unknown";

export class DocumentExtractionError extends Error {
  code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = "DocumentExtractionError";
    this.code = code;
  }
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(value: string) {
  const text = value.trim();
  return text ? text.split(/\s+/).length : 0;
}

function extensionOf(fileName: string): DocumentExtension | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "pdf" || extension === "docx" ? extension : null;
}

function extractionMessage(error: unknown) {
  if (error instanceof DocumentExtractionError) return error;

  const candidate = error as { name?: string; message?: string } | null;
  if (candidate?.name === "PasswordException") {
    return new DocumentExtractionError(
      "password_protected",
      "Este PDF é protegido por senha. Salve uma cópia sem senha e tente novamente.",
    );
  }

  return new DocumentExtractionError(
    "unknown",
    "Não foi possível ler o conteúdo deste documento. Tente outro arquivo.",
  );
}

async function extractPdf(file: File, documentId: string): Promise<ExtractedDocument> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });

  try {
    const pdf = await loadingTask.promise;
    const pages: ExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";

      for (const item of content.items) {
        if (!("str" in item)) continue;
        pageText += item.str;
        pageText += item.hasEOL ? "\n" : " ";
      }

      const text = normalizeText(pageText);
      pages.push({
        pageNumber,
        text,
        characterCount: text.length,
      });
      page.cleanup();
    }

    const pagesWithText = pages.filter((page) => page.text.length > 0).length;
    const documentText = pages
      .filter((page) => page.text.length > 0)
      .map((page) => page.text)
      .join("\n\n");
    const fullText = pages
      .filter((page) => page.text.length > 0)
      .map((page) => `[Página ${page.pageNumber}]\n${page.text}`)
      .join("\n\n");

    if (!documentText.trim() || pagesWithText === 0) {
      throw new DocumentExtractionError(
        "no_extractable_text",
        "Não encontrei texto selecionável neste PDF. Ele parece ser digitalizado ou composto por imagens. Nesta fase, o Fichário ainda não faz OCR.",
      );
    }

    const warnings: string[] = [];
    const emptyPages = pdf.numPages - pagesWithText;
    if (emptyPages > 0) {
      warnings.push(
        `${emptyPages} ${emptyPages === 1 ? "página não possui" : "páginas não possuem"} texto extraível.`,
      );
    }

    return {
      documentId,
      name: file.name,
      extension: "pdf",
      fullText,
      pages,
      pageCount: pdf.numPages,
      pagesWithText,
      characterCount: documentText.length,
      wordCount: wordCount(documentText),
      warnings,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw extractionMessage(error);
  } finally {
    await loadingTask.destroy();
  }
}

async function extractDocx(file: File, documentId: string): Promise<ExtractedDocument> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const fullText = normalizeText(result.value);

    if (!fullText.trim()) {
      throw new DocumentExtractionError(
        "no_extractable_text",
        "Não encontrei texto neste DOCX. Confira se o documento possui conteúdo digitado e tente novamente.",
      );
    }

    const warnings = result.messages.length > 0
      ? ["O Word informou avisos durante a leitura. O texto extraído continua disponível para conferência."]
      : [];

    return {
      documentId,
      name: file.name,
      extension: "docx",
      fullText,
      pages: [],
      characterCount: fullText.length,
      wordCount: wordCount(fullText),
      warnings,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw extractionMessage(error);
  }
}

export async function extractDocument(file: File, documentId: string): Promise<ExtractedDocument> {
  const extension = extensionOf(file.name);

  if (!extension) {
    throw new DocumentExtractionError(
      "invalid_document",
      "Formato não aceito. Selecione um arquivo PDF ou DOCX.",
    );
  }

  return extension === "pdf"
    ? extractPdf(file, documentId)
    : extractDocx(file, documentId);
}
