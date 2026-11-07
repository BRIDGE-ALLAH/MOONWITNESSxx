FROM freeradius/freeradius-server:3.2.10

USER root

COPY docker/freeradius/raddb/mods-available/sql.template /etc/raddb/mods-available/sql.template
COPY docker/freeradius/raddb/sites-available/default /etc/raddb/sites-available/default
COPY docker/freeradius/raddb/sites-available/inner-tunnel /etc/raddb/sites-available/inner-tunnel
COPY docker/freeradius/entrypoint.sh /usr/local/sbin/atlas-freeradius-entrypoint

RUN ln -sf ../mods-available/sql /etc/raddb/mods-enabled/sql \
    && chmod 0755 /usr/local/sbin/atlas-freeradius-entrypoint

ENTRYPOINT ["/usr/local/sbin/atlas-freeradius-entrypoint"]
