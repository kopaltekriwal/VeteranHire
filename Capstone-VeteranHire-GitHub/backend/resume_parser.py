import io
import os
import re

from docx import Document
from PyPDF2 import PdfReader


SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


class ResumeParserError(ValueError):
    pass


def extract_resume_text(filename: str, file_bytes: bytes) -> str:
    extension = os.path.splitext(filename or "")[1].lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise ResumeParserError("Unsupported file format. Please upload a PDF or DOCX resume.")

    if extension == ".pdf":
        text = _extract_pdf_text(file_bytes)
    else:
        text = _extract_docx_text(file_bytes)

    cleaned_text = _clean_text(text)
    if not cleaned_text:
        raise ResumeParserError("The uploaded resume appears to be empty or unreadable.")

    return cleaned_text


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_docx_text(file_bytes: bytes) -> str:
    document = Document(io.BytesIO(file_bytes))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def _clean_text(text: str) -> str:
    normalized_text = text.replace("\x00", " ")
    normalized_text = re.sub(r"\r\n?", "\n", normalized_text)
    normalized_text = re.sub(r"[ \t]+", " ", normalized_text)
    normalized_text = re.sub(r"\n{3,}", "\n\n", normalized_text)
    return normalized_text.strip()
