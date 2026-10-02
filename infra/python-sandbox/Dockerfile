# The image the translator's editor runs Python code blocks in ("Code ausführen"), built after
# HAWKI's code-exec sandbox: Python 3.13 with numpy, pandas, scipy and matplotlib, run as
# `sandboxuser`. The server starts one container per run (see
# apps/server/src/modules/translator/python.ts). Build: `bun run sandbox:build`.
FROM python:3.13.13-slim-trixie

RUN pip install --no-cache-dir \
      pip==26.0.1 \
      contourpy==1.3.3 \
      cycler==0.12.1 \
      fonttools==4.63.0 \
      kiwisolver==1.5.0 \
      matplotlib==3.10.9 \
      numpy==2.4.6 \
      packaging==26.2 \
      pandas==3.0.3 \
      pillow==12.2.0 \
      pyparsing==3.3.2 \
      python-dateutil==2.9.0.post0 \
      scipy==1.17.1 \
      six==1.17.0 \
  && useradd --create-home --uid 1000 sandboxuser \
  && chmod 700 /home/sandboxuser

# Docker puts /.dockerenv into every container, HAWKI's too; the image brings it for Podman
# (runsc-rootless), so code that looks for it finds itself in a container there as well.
RUN touch /.dockerenv && chmod 755 /.dockerenv

# Plots draw without a screen; the root file system is read-only, /tmp is not.
ENV MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp
# HAWKI's containers have the university's proxy configured, which they cannot reach without a
# network: code that goes online fails with "[Errno 101] Network is unreachable", here too.
ENV http_proxy=http://10.60.3.254:3128 \
    https_proxy=http://10.60.3.254:3128

USER sandboxuser
WORKDIR /work
